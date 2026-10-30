## Encoding, hashing, encryption

Three things that get mixed up all the time:

| | Purpose | Reversible? | Key? | Example |
|---|---|---|---|---|
| **Encoding** | data transport/format | yes, by anyone | no | Base64, URL encoding, hex |
| **Hash** | data fingerprint, integrity | no (one-way) | no | SHA-256, SHA-3 |
| **Encryption** | confidentiality | yes, but only with the key | yes | AES-GCM, RSA-OAEP |

> Base64 is **not** protection. Kubernetes `Secret` objects are, by default, only base64-encoded in etcd. Real protection requires etcd encryption (a KMS provider) or an external secrets manager.

## Hash functions

A good cryptographic hash function:

- produces fixed-length output (SHA-256: 256 bits),
- is one-way: the input can't be derived from the hash,
- is collision-resistant: it's practically impossible to find two inputs with the same hash,
- has an avalanche effect: changing one bit changes half of the output.

| Algorithm | Status |
|---|---|
| MD5 | **broken** (collisions in seconds). Only for non-security checksums. |
| SHA-1 | **broken** (practical collisions since 2017). Git still uses it as an identifier, but is moving to SHA-256. |
| SHA-256 / SHA-512 (SHA-2) | secure, the standard |
| SHA-3, BLAKE2/BLAKE3 | secure |

Uses: verifying the integrity of downloaded files (`sha256sum -c`), content-addressable storage (Docker image digest `sha256:…`), signatures (it's the hash that gets signed).

### HMAC

A plain hash doesn't prove **who** created a message: anyone can compute SHA-256. **HMAC** (hash + secret key) provides integrity **and** authenticity between parties that share the key. It's used by webhooks (GitHub `X-Hub-Signature-256`), JWT HS256 and AWS request signing (SigV4).

HMAC values are compared with a **constant-time** function (`hmac.compare_digest`), so an attacker can't guess byte by byte by measuring response times.

### Password hashing

Passwords are hashed with **deliberately slow** algorithms and a **salt**:

- **Argon2id** (OWASP's recommendation), scrypt, bcrypt, PBKDF2 (when FIPS compliance is required).
- A salt is a random value per user. The same password doesn't produce the same hash, so rainbow tables don't help.
- A "pepper" is an additional secret kept outside the database (e.g. in an HSM or KMS).

## Symmetric cryptography

The same key encrypts and decrypts. It's fast, so it's used for data.

- **AES** (a block cipher, 128- or 256-bit key) in **GCM** mode, or **ChaCha20-Poly1305**. Both are **AEAD** (Authenticated Encryption with Associated Data): they provide confidentiality **and** integrity. A modified ciphertext is rejected during decryption.
- Avoid **ECB** (identical plaintext blocks produce identical ciphertext blocks, the famous "ECB penguin") and CBC without a MAC.
- A **nonce/IV must never be reused** with the same key in GCM. A repeated nonce in GCM is a disaster: it leaks the XOR of the plaintexts and enables forgery.

The problem with symmetric cryptography is **key distribution**: how do both parties get the same key without anyone intercepting it?

## Asymmetric cryptography

A key pair: **public** (shared freely) and **private** (never leaves its owner).

| Operation | Who uses which key | Purpose |
|---|---|---|
| Encryption | the sender encrypts with the recipient's **public** key; only the **private** key decrypts | confidentiality |
| Signature | the owner signs with the **private** key; anyone verifies with the **public** key | authenticity, integrity, non-repudiation |
| Key exchange (ECDH) | both parties derive the same secret key from their own private keys and each other's public keys | agreeing on a symmetric key over an insecure channel |

Algorithms: **RSA** (2048+ bits, OAEP padding for encryption, PSS for signatures), **ECDSA** (P-256), **Ed25519** (modern, fast, hard to misuse), **X25519** for key exchange.

Asymmetric cryptography is slow, so in practice it's combined with symmetric cryptography (**hybrid encryption**): the symmetric key is agreed on or protected asymmetrically, and the data is encrypted symmetrically. That's how TLS works.

## Digital signatures in DevOps

- **Commits** signed with an SSH or GPG key (GitHub "Verified").
- **Artifacts and container images**: Sigstore/cosign (keyless signing via OIDC identity and the Rekor transparency log).
- **Packages**: apt and rpm repositories are signed. That's why `curl … | sudo bash` bypasses the protection the package manager otherwise provides.
- Kubernetes admission policies (Kyverno, Sigstore policy-controller) can allow only signed images.

## Key management

The cryptography is usually strong. The keys are the weak point.

- **KMS** (AWS KMS, Azure Key Vault, GCP KMS) and **HSM**: the key never leaves the service, and every use is logged and subject to IAM policies.
- **Envelope encryption**: data is encrypted with a **data key (DEK)**, and the DEK is encrypted with a **master key (KEK)** in KMS. You store the encrypted data and the encrypted DEK. To decrypt, KMS decrypts the DEK, only with permission and with a log entry. Rotating the KEK doesn't require re-encrypting all the data.
- **Rotation**: regular (e.g. yearly for the KEK; KMS does it automatically) and immediately after a suspected compromise.
- **Separation of duties**: whoever administers a key shouldn't have access to the data, and vice versa.
- **Crypto-shredding**: deleting the key makes the data unreadable, which is useful for GDPR deletion from backups.

## Randomness

Keys, nonces, session tokens and salts must come from a **cryptographically secure** generator (CSPRNG): `/dev/urandom`, `getrandom()`, `secrets` in Python, `crypto.randomBytes` in Node. Never from `random()` or `Math.random()`.

## Post-quantum cryptography (PQC)

A sufficiently large quantum computer could use Shor's algorithm to break **RSA and ECC** (key exchange and signatures). Symmetric cryptography and hash functions are much less affected: AES-256 and SHA-256/384 remain usable.

- In August 2024 NIST published the first PQC standards: **FIPS 203 ML-KEM** (key exchange, formerly Kyber), **FIPS 204 ML-DSA** (signatures, formerly Dilithium) and **FIPS 205 SLH-DSA** (hash-based signatures).
- The **"harvest now, decrypt later"** threat: an attacker records encrypted traffic today and decrypts it once quantum computers are available. That's why key exchange is migrated first.
- Browsers and large CDNs already use **hybrid** key exchange in TLS 1.3 (X25519 + ML-KEM-768), and OpenSSH has used a hybrid PQ algorithm as its default since version 10.0.
- What to do today: build a **cryptography inventory** (where RSA and ECC are used, how long data must stay secret) and aim for **crypto-agility** (an algorithm can be swapped via configuration, not by rewriting code).

## Common mistakes

- Writing your own cryptography or protocols. Use proven libraries (libsodium, Tink, the language's standard libraries).
- Keys and passwords in code, Docker images or env files in git.
- Disabled certificate verification (`verify=False`, `curl -k`, `InsecureSkipVerify: true`) that stays in production.
- A reused nonce, ECB mode, MD5/SHA-1 for security, a fast hash for passwords.

## Summary

- Encoding is not protection. Hashing is for integrity, HMAC for integrity and authenticity, encryption for confidentiality.
- AES-GCM or ChaCha20-Poly1305 for data; Ed25519, ECDSA or RSA-PSS for signatures; X25519 for key exchange.
- Passwords: Argon2id with a salt.
- Keys in KMS, envelope encryption, rotation.
- PQC: ML-KEM and ML-DSA are the standards; start with an inventory and crypto-agility.
