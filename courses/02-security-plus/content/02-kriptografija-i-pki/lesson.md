## Ciljevi ispita: 1.3

- **1.3** Explain the importance of using appropriate cryptographic solutions.

Ispit traži da za datu situaciju izabereš odgovarajuće kriptografsko rješenje: koji algoritam, koji nivo enkripcije, CRL ili OCSP, wildcard ili SAN, TPM ili HSM, hash ili enkripcija. Matematika se ne pita. Pita se **čemu šta služi**.

## Osnovni pojmovi

| Pojam | Značenje |
|---|---|
| **Plaintext** / **ciphertext** | Čitljiv podatak / šifrovan podatak |
| **Algorithm (cipher)** | Postupak šifrovanja, javno poznat (npr. AES) |
| **Key** | Tajna vrijednost. Sigurnost zavisi od ključa, ne od tajnosti algoritma. |
| **Key length** | Dužina ključa u bitima. Duži ključ = veći prostor za brute force. |
| **Data at rest / in transit / in use** | Podaci na disku / u prenosu / u memoriji tokom obrade |

## Simetrična enkripcija

**Symmetric encryption** koristi **isti ključ** za šifrovanje i dešifrovanje.

- Brza, pogodna za velike količine podataka (diskovi, baze, tok podataka u TLS-u).
- Problem: kako bezbjedno dostaviti ključ drugoj strani (**key distribution**). To rješava asimetrična kriptografija i razmjena ključeva.
- Broj ključeva raste brzo: svaki par korisnika treba svoj ključ.

| Algoritam | Status | Napomena |
|---|---|---|
| **AES** (128, 192, 256 bita) | Standard | Koristi ga skoro sve: TLS, BitLocker, LUKS, S3/EBS enkripcija. Mod **GCM** daje i integritet (AEAD). |
| **ChaCha20-Poly1305** | Moderan | Brz u softveru, čest na mobilnim uređajima, podržan u TLS 1.3. |
| **3DES** | Zastario | Mali blok (64 bita), izbačen iz modernih standarda. |
| **DES**, **RC4** | Nesiguran | Ne koristiti. |

Simetrični algoritmi su **block** (AES šifruje blokove od 128 bita) ili **stream** (ChaCha20 šifruje tok bajtova).

## Asimetrična enkripcija

**Asymmetric encryption** koristi par ključeva: **public key** (javni, dijeli se slobodno) i **private key** (privatni, nikad ne napušta vlasnika).

| Šta želiš | Koji ključ se koristi |
|---|---|
| Da samo primalac pročita poruku (povjerljivost) | Šifruješ **javnim ključem primaoca**, on dešifruje svojim privatnim |
| Da dokažeš da si ti poslao (potpis) | Potpisuješ **svojim privatnim ključem**, svako provjerava tvojim javnim |

| Algoritam | Upotreba |
|---|---|
| **RSA** | Enkripcija i potpisi. Ključ minimalno 2048 bita, preporuka 3072+ za dugoročnu zaštitu. |
| **ECC** (eliptičke krive, npr. P-256, Curve25519) | Ista sigurnost uz mnogo kraći ključ. Brže, manje resursa (mobilni, IoT). |
| **Diffie-Hellman (DH, ECDH)** | Razmjena ključeva, ne služi za enkripciju poruka. |
| **DSA, ECDSA, Ed25519** | Digitalni potpisi |

Asimetrična kriptografija je spora, pa se u praksi koristi **hibridni pristup**: asimetrično se dogovori ili razmijeni simetrični **session key**, a zatim se podaci šifruju simetrično (AES). Tako radi TLS.

### Dužina ključa

- Simetrično: **AES-128** je i danas siguran, **AES-256** je izbor za visoke zahtjeve i dugoročnu zaštitu.
- Asimetrično: RSA ključevi moraju biti mnogo duži od ECC ključeva za sličnu sigurnost. ECC ključ od 256 bita je otprilike ekvivalentan RSA ključu od 3072 bita.
- Duži ključ = sporije operacije. Bira se balans prema riziku i vijeku podataka.
- **Post-kvantna kriptografija**: NIST je 2024. objavio prve standarde (npr. ML-KEM za razmjenu ključeva i ML-DSA za potpise). Kvantni računari bi ugrozili RSA i ECC, dok se za simetrične algoritme preporučuje duži ključ (AES-256).

> **Na ispitu:** Ako pitanje traži jaku enkripciju na uređaju sa malo procesorske snage (IoT, mobilni) ili kraći ključ uz istu sigurnost, odgovor je **ECC**. Ako traži brzu enkripciju velike količine podataka, odgovor je **simetrična (AES)**.

## Razmjena ključeva

**Key exchange** rješava problem: kako dvije strane preko nesigurne mreže dobiju isti tajni ključ.

- **Diffie-Hellman / ECDH**: obje strane izračunaju isti tajni ključ, a sam ključ nikad ne putuje mrežom.
- **Ephemeral** varijante (**DHE**, **ECDHE**) prave novi ključ za svaku sesiju. To daje **Perfect Forward Secrecy (PFS)**: ako kasnije procuri privatni ključ servera, snimljeni stari saobraćaj se i dalje ne može dešifrovati.
- Stari pristup (RSA key transport: klijent šifruje session key javnim RSA ključem servera) **nema PFS** i izbačen je iz TLS 1.3.
- **Out-of-band** razmjena: ključ se dostavlja drugim kanalom (npr. lično, preko KMS-a).

> **Na ispitu:** „Kompromitovan privatni ključ servera ne smije omogućiti dešifrovanje ranije snimljenog saobraćaja" = **Perfect Forward Secrecy** = **ECDHE/DHE**.

## Protokoli i transportna enkripcija

**Transport/communication encryption** štiti podatke u prenosu.

| Protokol | Upotreba | Napomena |
|---|---|---|
| **TLS 1.3 / 1.2** | HTTPS, API-ji, baze, SMTP STARTTLS | SSL 2/3, TLS 1.0 i 1.1 su zastarjeli i treba ih isključiti |
| **IPsec** | Site-to-site VPN (AWS Site-to-Site VPN, Azure VPN Gateway) | AH = integritet i autentifikacija, ESP = i enkripcija |
| **SSH** | Udaljena administracija, SFTP, git | Zamjena za Telnet, FTP, rlogin |
| **HTTPS, SFTP, LDAPS, SNMPv3, SRTP** | Sigurne verzije starijih protokola | Nesigurne: HTTP, FTP, LDAP (389 bez TLS-a), SNMPv1/2c, Telnet |
| **S/MIME, PGP** | Enkripcija i potpis e-maila | |
| **WPA3** | Bežične mreže | |

U Kubernetesu: mTLS između servisa (service mesh), TLS na Ingressu, enkripcija etcd-a. U cloudu: TLS na load balanceru i end-to-end TLS do backenda za osjetljive podatke.

## Nivoi enkripcije podataka u mirovanju

Ciljevi navode **Level**: koliko „široko" se šifruje.

| Nivo | Engleski | Šta štiti | Primjeri |
|---|---|---|---|
| Cijeli disk | **Full disk** | Sve na disku, uključujući OS i swap. Štiti od krađe uređaja. | BitLocker, FileVault, LUKS, enkripcija EBS volumena / Azure managed diska |
| Particija | **Partition** | Jednu particiju na disku | Šifrovana data particija, ostale nešifrovane |
| Volumen | **Volume** | Logički volumen (može obuhvatiti više diskova ili dio diska) | BitLocker na data volumenu, LVM + LUKS |
| Fajl | **File** | Pojedinačne fajlove ili foldere | EFS na Windowsu, gpg/age šifrovan fajl, SOPS za tajne u git-u |
| Baza | **Database** | Cijelu bazu, fajlove baze i backupe | **TDE** (Transparent Data Encryption) u SQL Serveru i Oracleu, enkripcija RDS instance |
| Zapis / kolona | **Record** | Pojedinačne redove ili polja (npr. broj kartice) | Always Encrypted, enkripcija na nivou aplikacije prije upisa |

Bitno pravilo: enkripcija diska štiti **kad je sistem ugašen ili disk ukraden**. Dok je sistem pokrenut i otključan, podaci su vidljivi svakom ko ima pristup OS-u. Za zaštitu od korisnika ili admina sa pristupom bazi treba **record/column-level** enkripcija.

> **Na ispitu:** „Laptop je ukraden" → **full disk encryption**. „DBA ne smije vidjeti brojeve kartica, ostali podaci su OK" → **record (column) level**. „Treba šifrovati cijelu bazu i backupe bez izmjene aplikacije" → **database (TDE)**.

## Hashing

**Hashing** je jednosmjerna funkcija: od ulaza bilo koje dužine daje izlaz fiksne dužine (**digest**). Iz hasha se ne može vratiti ulaz. Ista vrijednost uvijek daje isti hash.

- Služi za **integritet** (provjera preuzetog fajla, image digest u Dockeru `sha256:…`) i za čuvanje lozinki.
- **Collision** (kolizija): dva različita ulaza daju isti hash. Kod dobrog algoritma praktično nemoguće.

| Algoritam | Status |
|---|---|
| **MD5** | Razbijen (kolizije). Ne koristiti za sigurnost. |
| **SHA-1** | Zastario (praktične kolizije). Izbačen iz certifikata. |
| **SHA-2** (SHA-256, SHA-384, SHA-512) | Standard danas |
| **SHA-3** | Moderna alternativa sa drugačijom konstrukcijom |
| **HMAC** | Hash + tajni ključ. Daje integritet i autentičnost poruke, ali ne non-repudiation. |

### Hashovanje lozinki i salting

Brz hash (SHA-256) je loš za lozinke jer napadač može testirati milijarde pokušaja u sekundi na GPU-ima.

- **Salting**: nasumična vrijednost (**salt**) se doda svakoj lozinki prije hashovanja i čuva uz hash. Dva korisnika sa istom lozinkom imaju različite hasheve. Salt onemogućava **rainbow table** napade (unaprijed izračunate tabele hash → lozinka).
- **Key stretching**: algoritam namjerno spor i ponavlja se mnogo puta: **bcrypt**, **scrypt**, **PBKDF2**, **Argon2**. Usporava brute force.
- **Pepper**: dodatna tajna vrijednost koja se čuva odvojeno od baze (npr. u HSM-u ili KMS-u).

> **Na ispitu:** „Dva korisnika imaju isti hash u bazi" ili „napadač koristi rainbow tables" → odgovor je **salting**. „Treba usporiti brute force nad ukradenim hashevima" → **key stretching** (bcrypt, PBKDF2, Argon2).

## Digitalni potpisi

**Digital signature** dokazuje porijeklo i integritet podataka.

1. Pošiljalac izračuna hash poruke.
2. Hash potpiše (šifruje) svojim **privatnim ključem**.
3. Primalac izračuna hash primljene poruke i provjeri potpis **javnim ključem pošiljaoca**.
4. Ako se poklapa: poruka nije mijenjana (**integrity**), poslao ju je vlasnik privatnog ključa (**authentication**), i on to ne može poreći (**non-repudiation**).

Potpis **ne daje povjerljivost**. Poruka može biti potpisana i potpuno čitljiva. Za povjerljivost se dodatno šifruje.

Primjeri: code signing (Windows Authenticode), potpisivanje container slika (cosign), potpisani git commitovi, DKIM potpisi e-maila, potpisani JWT tokeni (RS256/ES256).

## PKI: infrastruktura javnih ključeva

**Public Key Infrastructure (PKI)** je skup uloga, politika i sistema za izdavanje, upravljanje i opoziv digitalnih certifikata. Certifikat povezuje **javni ključ** sa identitetom (domen, osoba, uređaj), a tu vezu potvrđuje **CA** svojim potpisom.

### Certificate authorities i root of trust

- **Certificate authority (CA)**: izdaje i potpisuje certifikate.
- **Root CA**: na vrhu hijerarhije, self-signed. Njegov privatni ključ je najvredniji, pa se root CA često drži **offline** (u HSM-u), a certifikate svakodnevno izdaju **intermediate (subordinate) CA**.
- **Root of trust**: polazna tačka kojoj se bezuslovno vjeruje. U pregledaču i OS-u to je skup root certifikata u **trust store**-u. Lanac povjerenja (**chain of trust**): server cert → intermediate CA → root CA iz trust store-a. U hardveru, root of trust je npr. TPM.
- **Registration authority (RA)**: provjerava identitet podnosioca prije izdavanja.

### Self-signed vs third-party

| | **Self-signed** | **Third-party** (javni CA) | Interni (privatni) CA |
|---|---|---|---|
| Ko potpisuje | Sam vlasnik ključa | Javni CA (npr. Let's Encrypt, DigiCert) | Organizacijski CA (AD CS, AWS Private CA, cert-manager CA) |
| Povjerenje | Niko mu automatski ne vjeruje | Vjeruju mu svi pregledači | Vjeruju uređaji kojima je dodan root |
| Upotreba | Test, lab | Javni web servisi | Interni servisi, mTLS, VPN |

> **Na ispitu:** Korisnici dobijaju upozorenje u pregledaču na internom portalu → certifikat je **self-signed** ili iz internog CA koji nije u trust store-u. Rješenje: certifikat od **third-party CA** ili distribucija internog root certifikata na uređaje (npr. GPO, MDM).

### CSR i životni ciklus certifikata

**Certificate signing request (CSR)** generation:

1. Generiši par ključeva na serveru (privatni ključ ostaje na serveru).
2. Napravi CSR: sadrži **javni ključ** i podatke o identitetu (CN, SAN, organizacija), potpisan privatnim ključem.
3. Pošalji CSR CA-u.
4. CA provjeri identitet (npr. DNS ili HTTP challenge za domen) i potpiše certifikat.
5. Instaliraj certifikat na server i prati istek.

```bash
openssl req -new -newkey rsa:3072 -nodes -keyout api.key -out api.csr \
  -subj "/CN=api.example.com" -addext "subjectAltName=DNS:api.example.com"
```

Privatni ključ **nikad** ne ide CA-u. U Kubernetesu ovo automatizuje **cert-manager** (ACME), a u AWS-u ACM.

Vijek javnih TLS certifikata se skraćuje (CA/Browser Forum je usvojio postepeno smanjenje sa 398 dana na 47 dana do 2029.), pa je automatsko obnavljanje obavezno.

### Wildcard i SAN

- **Wildcard** certifikat `*.example.com` važi za `api.example.com`, `www.example.com`, ali **ne** za `example.com` niti za `a.b.example.com` (pokriva samo **jedan nivo**).
- **SAN (Subject Alternative Name)**: lista više konkretnih imena u jednom certifikatu (`example.com`, `api.example.com`, `example.org`).
- Rizik wildcarda: ako ključ procuri sa jednog servera, napadač može lažirati **sve** poddomene. Isti ključ na mnogo mjesta povećava izloženost.

### Opoziv: CRL i OCSP

Certifikat se opoziva (**revoke**) ako je privatni ključ kompromitovan, domen promijenio vlasnika ili je certifikat pogrešno izdat.

| | **CRL** (Certificate Revocation List) | **OCSP** (Online Certificate Status Protocol) |
|---|---|---|
| Kako radi | CA periodično objavi listu serijskih brojeva opozvanih certifikata | Klijent pita OCSP responder za status **jednog** certifikata |
| Ažurnost | Koliko je svježa poslednja lista | Status skoro u realnom vremenu |
| Veličina | Lista može biti velika | Mali odgovor: good, revoked, unknown |
| Privatnost | CA ne vidi koje sajtove posjećuješ | Responder vidi koji certifikat provjeravaš |

- **OCSP stapling**: server sam periodično dobije potpisan OCSP odgovor i šalje ga klijentu tokom TLS handshake-a. Brže i bez curenja privatnosti.
- Trend: neki veliki javni CA-ovi (npr. Let's Encrypt 2025.) su prestali nuditi OCSP i oslanjaju se na CRL-ove uz kratak vijek certifikata. Za ispit i dalje znaj razliku CRL vs OCSP.

> **Na ispitu:** „Provjera statusa jednog certifikata u realnom vremenu" → **OCSP**. „Lista svih opozvanih certifikata koju CA objavljuje" → **CRL**. „Server prilaže status uz handshake" → **OCSP stapling**.

### Key escrow

**Key escrow**: kopija ključa se čuva kod pouzdane treće strane ili u sigurnom sistemu, da bi se podaci mogli vratiti ako se ključ izgubi (zaposleni ode, korisnik zaboravi lozinku). Primjer: BitLocker recovery ključevi pohranjeni u Entra ID / Active Directory. Rizik: escrow sistem postaje vrlo vrijedna meta pa mora biti strogo zaštićen.

## Kriptografski alati

Ciljevi navode **Tools** bez detalja. Ispit tipično pita gdje se čuvaju ključevi.

| Alat | Opis | Primjer |
|---|---|---|
| **TPM** (Trusted Platform Module) | Čip na matičnoj ploči jednog uređaja. Čuva ključeve, mjeri boot (measured/secure boot), vezuje enkripciju diska za hardver. | BitLocker ključ u TPM-u, vTPM u Azure/AWS VM-ovima |
| **HSM** (Hardware Security Module) | Namjenski, otporan uređaj (ili mrežni servis) za generisanje i čuvanje ključeva i kripto operacije u velikom obimu. Ključ ne napušta HSM. | Root CA ključ, ključevi za plaćanja, AWS CloudHSM, Azure Dedicated/Managed HSM |
| **KMS** (Key Management System) | Centralno upravljanje životnim ciklusom ključeva: kreiranje, rotacija, politike pristupa, audit. Često iza sebe koristi HSM. | AWS KMS, Azure Key Vault, Google Cloud KMS, HashiCorp Vault |
| **Secure enclave** | Izolovano okruženje u procesoru koje štiti kod i podatke **u upotrebi** čak i od OS-a | Apple Secure Enclave, Intel SGX, AWS Nitro Enclaves, Azure confidential computing |

> **Na ispitu:** **TPM** = jedan uređaj (laptop, server), vezan za matičnu ploču. **HSM** = centralizovano, visoke performanse, za mnogo ključeva i servera (CA, banke). **KMS** = upravljanje ključevima (rotacija, politike). **Secure enclave** = zaštita podataka **in use**.

## Obfuskacija

**Obfuscation** čini podatke teškim za razumijevanje, ali to nije uvijek enkripcija.

| Tehnika | Engleski | Kako radi | Primjer |
|---|---|---|---|
| Steganografija | **Steganography** | Skriva postojanje poruke unutar drugog medija (slika, zvuk, video, mrežni paketi) | Podaci u najmanje značajnim bitovima piksela slike; malver koji preuzima komande skrivene u slici |
| Tokenizacija | **Tokenization** | Osjetljiva vrijednost se zamijeni nasumičnim tokenom. Veza token → original čuva se u odvojenom **token vault**-u. Token nema matematičku vezu sa originalom. | Broj kartice u e-commerce sistemu zamijenjen tokenom (smanjuje PCI DSS opseg) |
| Maskiranje podataka | **Data masking** | Dio podatka se sakrije ili zamijeni (trajno ili samo pri prikazu) | Podrška vidi `**** **** **** 1234`; test baza sa lažnim imenima |
| Obfuskacija koda | Code obfuscation | Kod se preimenuje i zakomplikuje da bi se otežao reverse engineering | Minifikovan i obfuskovan JavaScript, zaštita mobilne aplikacije |

> **Na ispitu:** Tokenizacija je **reverzibilna samo preko vault-a**, a token se može koristiti u sistemima koji ne trebaju pravi podatak. Maskiranje obično nije reverzibilno za korisnika koji ga gleda. Steganografija **skriva da poruka uopšte postoji**, a enkripcija skriva **sadržaj**.

## Kako se sve spaja: TLS 1.3 konekcija

Jedna HTTPS konekcija koristi skoro sve iz ovog modula:

1. Klijent i server dogovore verziju (TLS 1.3) i **cipher suite** (npr. AES-256-GCM sa SHA-384).
2. **Key exchange**: obje strane pošalju ephemeral ECDHE vrijednosti i izračunaju zajednički tajni ključ (**PFS**).
3. Server pošalje **certifikat** i lanac do root CA. Klijent provjeri potpis CA, ime (CN/SAN, eventualno wildcard), rok važenja i status opoziva (**CRL/OCSP**, ili stapling).
4. Server **digitalno potpiše** handshake svojim privatnim ključem (RSA ili ECDSA), čime dokazuje da posjeduje ključ iz certifikata.
5. Podaci se dalje šifruju **simetrično** (AES-GCM ili ChaCha20), sa ugrađenom provjerom integriteta.

| Element | Uloga u konekciji |
|---|---|
| ECDHE | Razmjena ključeva i forward secrecy |
| Certifikat + CA | Autentifikacija servera |
| RSA/ECDSA potpis | Dokaz posjedovanja privatnog ključa |
| AES-GCM / ChaCha20 | Povjerljivost i integritet podataka |
| SHA-2 | Hashovanje unutar handshake-a i izvođenja ključeva |

**mTLS** (mutual TLS) dodaje i klijentski certifikat, pa i server provjerava klijenta. Koristi se između mikroservisa u service meshu i za API-je partnera.

## Rezime

- **Simetrično** (AES, ChaCha20): jedan ključ, brzo, za velike podatke. **Asimetrično** (RSA, ECC): par ključeva, sporo, za razmjenu ključeva i potpise. ECC = kraći ključ, ista sigurnost.
- **Key exchange**: DH/ECDH. Ephemeral (ECDHE) daje **Perfect Forward Secrecy**.
- Transport: TLS 1.2/1.3, IPsec, SSH. Isključi SSL, TLS 1.0/1.1, Telnet, FTP.
- Nivoi enkripcije: full disk (krađa uređaja), partition, volume, file, database (TDE), record (osjetljiva polja).
- **Hashing** (SHA-2/3) = integritet. MD5 i SHA-1 su zastarjeli. Za lozinke: **salt** + key stretching (bcrypt, Argon2, PBKDF2).
- **Digitalni potpis**: privatni ključ potpisuje, javni provjerava. Daje integrity, authentication i non-repudiation.
- PKI: CA, root of trust, CSR (sadrži javni ključ), wildcard (jedan nivo), **CRL** vs **OCSP** (+ stapling), key escrow, self-signed vs third-party.
- Alati: TPM (uređaj), HSM (centralno, hardver), KMS (upravljanje), secure enclave (data in use). Obfuskacija: steganografija, tokenizacija, maskiranje.
