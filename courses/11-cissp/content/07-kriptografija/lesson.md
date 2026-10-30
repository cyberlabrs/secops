## Ciljevi ispita: 3.6 i 3.7

Kriptografija je dio domena 3 i na ispitu se pojavljuje i u drugim domenima (mreže, IAM, operacije). CISSP ne traži matematiku, nego **izbor pravog rješenja za zahtjev**: šta pruža povjerljivost, šta integritet, šta neporecivost, koji ključ se koristi za šta i kako se ključevima upravlja.

- **3.6 Select and determine cryptographic solutions**
  - kriptografski životni ciklus (ključevi, izbor algoritma),
  - prakse upravljanja ključevima (rotacija, upravljanje pristupom),
  - kriptografske metode (simetrične, asimetrične, eliptične krive, post-kvantne),
  - digitalni potpisi i digitalni certifikati (neporecivost, integritet),
  - PKI (npr. distribucija ključeva).
- **3.7 Understand methods of cryptanalytic attacks**
  - brute force, ciphertext only, known plaintext, chosen ciphertext, frequency analysis,
  - timing, side-channel, fault injection, implementation attacks,
  - Adversary-in-the-Middle (MITM), pass the hash, Kerberos exploitation,
  - ransomware, zero-day napadi, AI prijetnje (adversarial AI, trovanje modela, deepfake).

> U outlineu iz 2024. 3.6 je pominjao „quantum“ umjesto „post-quantum“ metoda, upravljanje ključevima samo sa primjerom „rotation“, a PKI sa primjerom „quantum key distribution“. U 3.7 je stajalo „Man-in-the-Middle“, a nije bilo zero-day napada ni AI prijetnji. QKD i dalje treba znati na nivou pojma (vidi PKI sekciju).

Napadi u 3.7 su ovdje opisani **iz ugla odbrane**: šta napad iskorištava i koja kontrola ga sprečava.

## Ciljevi kriptografije i osnovni pojmovi

| Cilj | Šta obezbjeđuje | Mehanizam |
|---|---|---|
| **Povjerljivost** | samo ovlašteni čitaju | simetrično/asimetrično šifrovanje |
| **Integritet** | izmjena se otkriva | hash, MAC/HMAC, digitalni potpis, AEAD |
| **Autentifikacija** | potvrda identiteta pošiljaoca/strane | MAC (dijeljena tajna), potpis, certifikati, challenge-response |
| **Neporecivost (nonrepudiation)** | pošiljalac ne može poreći da je poslao | **samo digitalni potpis** (privatni ključ ima samo jedna strana) |

Pojmovi:

- **Kerckhoffsov princip**: sistem mora biti siguran i kada je sve osim ključa javno. Zato se koriste javni, analizirani algoritmi, ne „tajni“.
- **Confusion** (veza ključa i šifrata je složena, supstitucija) i **diffusion** (promjena jednog bita plaintexta mijenja mnogo bitova šifrata, permutacija), Shannon.
- **Work factor**: vrijeme i trud potreban za razbijanje; cilj je da prelazi vrijednost i vijek podatka.
- **Key space**: 2^n za n-bitni ključ; svaki dodatni bit duplira broj kombinacija.
- **IV i nonce**: slučajna/jedinstvena vrijednost da isti plaintext ne daje isti šifrat. Ponovna upotreba nonce-a u CTR/GCM je katastrofalna greška.
- **Salt**: slučajna vrijednost uz lozinku prije hashovanja; sprečava rainbow tabele i otkriva iste lozinke.
- **Kodovi vs šifre**: kod zamjenjuje riječi ili fraze, šifra radi nad znakovima/bitovima. **Steganografija** sakriva postojanje poruke.
- **Stream vs block cipher**: stream šifruje bit po bit/bajt po bajt (ChaCha20, RC4 zastario), block u blokovima (AES 128 bita).

## Kriptografske metode (3.6)

### Simetrična kriptografija

Isti ključ šifruje i dešifruje. **Brza**, pogodna za velike količine podataka, ali ima problem **distribucije ključa** i **skalabilnosti**, i ne pruža neporecivost.

Broj ključeva za n korisnika: **n(n−1)/2**. Primjer: 100 korisnika treba 100 × 99 / 2 = **4.950** ključeva; 1.000 korisnika treba 499.500.

| Algoritam | Blok / ključ | Status |
|---|---|---|
| **AES** (Rijndael) | blok 128, ključ 128/192/256, 10/12/14 rundi | standard (FIPS 197) |
| **DES** | blok 64, ključ 56 (efektivno) | razbijen, ne koristiti |
| **3DES** (TDEA) | blok 64, 112/168 | povučen (NIST zabranio za šifrovanje nakon 2023) |
| **Blowfish / Twofish** | 64 / 128 bita blok | Blowfish zastario zbog bloka od 64 bita; Twofish AES finalist |
| **ChaCha20** | stream | moderan, uz Poly1305 kao AEAD (TLS 1.3, mobilni) |
| **RC4** | stream | razbijen |
| **IDEA, CAST, Skipjack** | | istorijski |

### Režimi rada blokovskih šifri

| Režim | Karakteristika | Napomena |
|---|---|---|
| **ECB** | svaki blok nezavisno, istim ključem | isti plaintext → isti šifrat; otkriva obrasce („ECB pingvin“); **ne koristiti** |
| **CBC** | XOR sa prethodnim šifratom, treba IV | sekvencijalan, ranjiv na padding oracle ako se loše implementira |
| **CFB / OFB** | pretvaraju blok u stream | OFB: greška se ne širi |
| **CTR** | brojač + nonce, paralelan | nonce ne smije da se ponovi |
| **GCM** | CTR + autentifikacija (AEAD) | povjerljivost i integritet zajedno; preporučen |
| **XTS** | za šifrovanje diskova | BitLocker, FileVault |

### Asimetrična kriptografija

Par ključeva: **javni** (dijeli se) i **privatni** (samo vlasnik). Sporija od simetrične (100–1.000 puta), rješava distribuciju ključeva i omogućava digitalni potpis. Broj ključeva: **2n** (100 korisnika = 200 ključeva).

| Šta želim | Koji ključ koristim |
|---|---|
| poslati povjerljivu poruku Ani | **Anin javni** ključ za šifrovanje (samo Anin privatni dešifruje) |
| potpisati poruku | **svoj privatni** ključ (svako provjerava mojim javnim) |
| provjeriti Anin potpis | **Anin javni** ključ |
| pročitati poruku šifrovanu za mene | **svoj privatni** ključ |

| Algoritam | Zasnovan na | Upotreba |
|---|---|---|
| **RSA** | faktorizacija velikih brojeva | šifrovanje, potpis, razmjena ključa; preporuka ≥ 3072 bita |
| **Diffie-Hellman (DH/ECDHE)** | diskretni logaritam | **samo razmjena (dogovor) ključa**, bez autentifikacije sam po sebi (ranjiv na MITM bez potpisa/certifikata) |
| **ElGamal** | diskretni logaritam | šifrovanje, potpis |
| **DSA / ECDSA / EdDSA** | diskretni logaritam / eliptične krive | samo potpis |
| **ECC** (eliptične krive) | diskretni logaritam na eliptičnim krivama | isti nivo sigurnosti sa mnogo kraćim ključem: 256-bitni ECC ≈ 3072-bitni RSA ≈ AES-128; idealno za mobilne i IoT |

**Hibridna kriptografija**: asimetrično se razmijeni (ili šifruje) **simetrični sesijski ključ**, a podaci se šifruju simetrično. Tako rade TLS, PGP, S/MIME. **Perfect forward secrecy (PFS)**: efemerni DH ključevi po sesiji, pa kompromitacija dugoročnog privatnog ključa ne otkriva ranije sesije.

### Simetrično vs asimetrično

| Kriterij | Simetrično | Asimetrično |
|---|---|---|
| Ključevi | jedan dijeljeni | par javni/privatni |
| Brzina | velika | mala |
| Broj ključeva za n korisnika | n(n−1)/2 | 2n |
| Distribucija ključa | problem (treba siguran kanal) | javni ključ se slobodno dijeli |
| Povjerljivost | da | da |
| Integritet / autentifikacija | samo uz MAC/AEAD | da (potpis) |
| Neporecivost | **ne** | **da** (potpis) |
| Tipična upotreba | šifrovanje podataka, sesije | razmjena ključa, potpis, certifikati |

### Kriptografija u protokolima

| Protokol | Šta koristi |
|---|---|
| **TLS 1.3** | ECDHE (PFS obavezan) za dogovor ključa, certifikat i potpis za autentifikaciju servera, AES-GCM ili ChaCha20-Poly1305 za podatke; uklonjeni RSA key exchange, CBC, RC4, SHA-1 |
| **IPsec** | IKE za razmjenu ključa; **AH** (integritet i autentifikacija, bez povjerljivosti), **ESP** (povjerljivost i integritet); transport vs tunnel mode |
| **SSH** | DH razmjena, autentifikacija ključevima ili lozinkom, simetrično šifrovanje sesije |
| **S/MIME** | X.509 certifikati (hijerarhijski PKI) za potpis i šifrovanje emaila |
| **PGP/GPG** | web of trust, hibridno šifrovanje emaila i fajlova |
| **Kerberos** | simetrični ključevi, KDC (AS + TGS), tiketi sa vremenskim ograničenjem; zahtijeva sinhronizovano vrijeme |

### Hash funkcije

Jednosmjerne funkcije fiksne dužine izlaza. Svojstva: **preimage resistance** (iz hasha ne može se dobiti ulaz), **second preimage resistance**, **collision resistance** (teško naći dva ulaza sa istim hashom).

| Algoritam | Izlaz | Status |
|---|---|---|
| MD5 | 128 | kolizije, ne za sigurnost |
| SHA-1 | 160 | kolizije (2017), povučen |
| **SHA-2** (SHA-256/384/512) | 224–512 | standard |
| **SHA-3** (Keccak) | 224–512 | drugačija konstrukcija (sponge), alternativa |
| bcrypt, scrypt, **Argon2**, PBKDF2 | | **spori** hashevi za lozinke (key stretching) |

**Birthday paradox**: za n-bitni hash kolizija se očekuje nakon oko 2^(n/2) pokušaja, pa SHA-256 daje 128 bita otpornosti na kolizije.

**MAC i HMAC**: hash sa tajnim ključem daje integritet i autentifikaciju porijekla, ali **ne** neporecivost (obje strane imaju isti ključ).

### Digitalni potpis

1. Pošiljalac izračuna **hash** poruke.
2. Hash potpiše (šifruje) **svojim privatnim ključem** → potpis.
3. Primalac izračuna hash primljene poruke, potpis provjeri **javnim ključem pošiljaoca** i uporedi.

Potpis pruža **integritet, autentifikaciju porijekla i neporecivost**, ali **ne povjerljivost**. Za povjerljivost se poruka dodatno šifruje javnim ključem primaoca. Standard: FIPS 186-5 (RSA, ECDSA, EdDSA), a post-kvantno ML-DSA i SLH-DSA.

> **Na ispitu:** Ako zahtjev traži **neporecivost**, jedini ispravan odgovor je **digitalni potpis** (asimetrično, privatni ključ pošiljaoca). HMAC i simetrično šifrovanje ne mogu pružiti neporecivost jer ključ dijele dvije strane. Ako pitanje pita kojim ključem Bob šifruje poruku za Alisu, odgovor je **Alisin javni**; kojim potpisuje, **Bobov privatni**.

### Post-kvantna kriptografija

| Prijetnja | Uticaj |
|---|---|
| **Shorov algoritam** | razbija RSA, DH, ECC (faktorizacija i diskretni logaritam) na kriptografski relevantnom kvantnom računaru |
| **Groverov algoritam** | kvadratno ubrzanje pretrage, efektivno prepolovljava simetrični ključ: AES-128 → ~64 bita, AES-256 → ~128 bita (i dalje sigurno) |

NIST standardi (avgust 2024):

| Standard | Algoritam | Namjena |
|---|---|---|
| **FIPS 203** | **ML-KEM** (CRYSTALS-Kyber) | enkapsulacija/razmjena ključa |
| **FIPS 204** | **ML-DSA** (CRYSTALS-Dilithium) | digitalni potpis |
| **FIPS 205** | **SLH-DSA** (SPHINCS+) | potpis zasnovan na hashu (rezervni pristup) |
| (u pripremi) | FN-DSA (Falcon), HQC | potpis; dodatni KEM |

Strategija: **inventar kriptografije** (gdje se koristi koji algoritam), **crypto agility** (mogućnost zamjene algoritma bez redizajna), **hibridni režimi** (klasični + PQC zajedno tokom prelaza, npr. X25519+ML-KEM u TLS-u), prioritet podacima dugog vijeka zbog **harvest now, decrypt later**.

Ostale napredne metode: **homomorfno šifrovanje** (računanje nad šifratom), **quantum key distribution (QKD)** (razmjena ključa kvantnim stanjima; prisluškivanje se otkriva jer mjerenje mijenja stanje; zahtijeva posebnu infrastrukturu, ne zamjenjuje PQC), **lightweight cryptography** (NIST Ascon za IoT).

## Kriptografski životni ciklus (3.6)

### Izbor algoritma

- koristiti **standardizovane, javno analizirane** algoritme i validirane implementacije (FIPS 140-3 moduli),
- dužina ključa prema vijeku podataka (NIST SP 800-57, SP 800-131A za prelaze i povlačenje),
- zahtjevi regulatora i industrije (PCI DSS, eIDAS),
- performanse i ograničenja platforme (IoT → ECC, lightweight),
- **nikad sopstvena kriptografija** („don't roll your own crypto“).

### Faze ključa (NIST SP 800-57)

| Faza | Šta se dešava |
|---|---|
| **Pre-operational** | generisanje (kvalitetan RNG), registracija, distribucija |
| **Operational** | upotreba za šifrovanje/potpis tokom **cryptoperioda**; čuvanje, backup |
| **Post-operational** | ključ se ne koristi za nove operacije, ali može dešifrovati stare podatke ili provjeriti stare potpise; arhiviranje |
| **Destroyed / compromised** | uništenje ili opoziv; kompromitovan ključ se odmah povlači i zamjenjuje |

**Cryptoperiod**: vrijeme u kojem je ključ ovlašten za upotrebu. Kraći cryptoperiod ograničava količinu podataka izloženih kompromitacijom. Određuje se prema osjetljivosti, količini podataka, okruženju i snazi algoritma.

Algoritmi takođe imaju životni ciklus: odobren → **deprecated** (dozvoljen uz prihvatanje rizika) → **disallowed** (zabranjen). Primjeri: DES, 3DES, SHA-1 za potpise, RSA-1024.

| Faktor | Kraći cryptoperiod | Duži cryptoperiod prihvatljiv |
|---|---|---|
| Osjetljivost podataka | visoka | niska |
| Količina podataka šifrovana ključem | velika | mala |
| Okruženje | izloženo (internet, mobilni) | zaštićeno (HSM, offline) |
| Snaga algoritma i dužina ključa | slabiji | jači |
| Trošak rotacije | nizak (automatizovano) | visok |

> **Na ispitu:** Kada pitanje traži FIRST korak u programu kriptografije ili pripremi za post-kvantni prelaz, odgovor je gotovo uvijek **inventar** (koje algoritme, ključeve i certifikate imamo i gdje) i politika, a ne trenutna zamjena algoritama. Bez inventara nema crypto agility ni plana migracije.

## Upravljanje ključevima (3.6)

Najveći broj kriptografskih neuspjeha nisu razbijeni algoritmi, nego **loše upravljanje ključevima**.

| Praksa | Opis |
|---|---|
| **Generisanje** | kriptografski siguran RNG, u HSM-u ili KMS-u gdje je moguće |
| **Distribucija** | out-of-band, razmjena ključa (DH/ECDHE), wrapping ključem za šifrovanje ključeva (**KEK**) |
| **Skladištenje** | HSM, KMS, TPM, secrets manager; nikad u izvornom kodu ili zajedno sa podacima |
| **Rotacija** | periodična zamjena po cryptoperiodu i odmah nakon sumnje na kompromitaciju; automatizovana |
| **Upravljanje pristupom** | least privilege nad ključevima, odvajanje administratora ključeva od administratora podataka, logovanje svake upotrebe |
| **Split knowledge** | nijedna osoba ne zna cijeli ključ |
| **Dual control / M-of-N** | potrebno M od N osoba (npr. 3 od 5 kartica) za kritičnu operaciju |
| **Key escrow** | kopija ključa kod pouzdane treće strane (npr. za zakonski pristup) |
| **Key recovery** | oporavak ključa ako se izgubi (npr. BitLocker recovery key u AD/Entra) |
| **Opoziv i uništenje** | CRL/OCSP za certifikate; sigurno brisanje iz HSM-a; **crypto-shredding** |
| **Hijerarhija ključeva** | master/KEK štiti DEK-ove (**envelope encryption**); rotacija KEK-a bez ponovnog šifrovanja svih podataka |

> **Na ispitu:** Ako su podaci šifrovani, a ključ se čuva na istom serveru ili u istom repozitoriju, šifrovanje praktično ne štiti. NAJBOLJI odgovor je **odvojiti ključeve od podataka** (KMS/HSM) i ograničiti pristup ključevima drugim timom (separation of duties). Rotacija je obavezna i **odmah** nakon sumnje na kompromitaciju.

## Digitalni certifikati i PKI (3.6)

**Digitalni certifikat (X.509 v3)** vezuje javni ključ za identitet, a potpisuje ga **CA**. Polja: verzija, serijski broj, algoritam potpisa, izdavalac (issuer), period važenja, subjekt, javni ključ, ekstenzije (**SAN**, key usage, extended key usage, basic constraints), potpis CA.

### Komponente PKI

| Komponenta | Uloga |
|---|---|
| **Certificate Authority (CA)** | izdaje i potpisuje certifikate; root CA (offline, u HSM-u) → intermediate/issuing CA |
| **Registration Authority (RA)** | provjerava identitet podnosioca zahtjeva; **ne potpisuje** certifikate |
| **CSR** | zahtjev za certifikat sa javnim ključem (privatni ključ ostaje kod podnosioca) |
| **CRL** | lista opozvanih certifikata; periodična, može biti velika i zastarjela |
| **OCSP** | provjera statusa certifikata u realnom vremenu; **OCSP stapling** server prilaže potpisani odgovor |
| **Certificate Policy (CP) / CPS** | pravila i praksa izdavanja |
| **Repozitorij** | objavljivanje certifikata i CRL-ova |

### Lanac povjerenja i modeli

- **Hijerarhijski model**: root → intermediate → end-entity. Klijent vjeruje rootu u trust storeu i provjerava potpise duž lanca.
- **Web of trust** (PGP): korisnici međusobno potpisuju ključeve, bez centralnog CA.
- **Cross-certification / bridge CA**: povjerenje između dvije PKI hijerarhije.
- Tipovi validacije: **DV** (kontrola domena), **OV** (organizacija), **EV** (prošireno).
- **Certificate pinning**: aplikacija prihvata samo određeni ključ/certifikat; smanjuje rizik od lažnog certifikata.
- **Certificate Transparency**: javni logovi svih izdatih certifikata za otkrivanje pogrešno izdatih.
- **Wildcard** (`*.example.com`) vs **SAN** certifikati; kraći rokovi važenja certifikata smanjuju štetu od kompromitacije i guraju automatizaciju (ACME).

### Distribucija ključeva

| Metoda | Kada |
|---|---|
| **Out-of-band** (lično, kurir) | početni ključevi, root ključevi, mali broj strana |
| **Diffie-Hellman / ECDHE** | dogovor sesijskog ključa preko nesigurnog kanala (uz autentifikaciju certifikatom) |
| **Asimetrično omotavanje** | sesijski ključ šifrovan javnim ključem primaoca |
| **KDC** (Kerberos) | centralni pouzdani server dijeli sesijske ključeve |
| **ML-KEM** | post-kvantna enkapsulacija ključa |
| **QKD** | fizički kanal sa kvantnim stanjima, specijalizovane mreže |

> **Na ispitu:** Ako je privatni ključ servera kompromitovan, PRVI korak je **opoziv certifikata** (CRL/OCSP) i izdavanje novog sa novim ključnim parom. Samo obnavljanje certifikata sa istim ključem ne rješava problem. Ako je kompromitovan **root CA**, svi certifikati u hijerarhiji su nepouzdani: zato je root offline, u HSM-u, pod dual controlom.

## Metode kriptoanalitičkih napada (3.7)

### Klasični modeli napada

| Napad | Šta napadač ima | Odbrana |
|---|---|---|
| **Brute force** | samo šifrat i vrijeme; isprobava sve ključeve | dovoljna dužina ključa (AES-128+), spori hashevi i salt za lozinke, zaključavanje naloga, rate limiting |
| **Ciphertext only** | samo šifrate | najteži za napadača; jaki moderni algoritmi |
| **Known plaintext** | parove plaintext/šifrat | algoritmi otporni na ovaj model (svi moderni), jedinstveni IV/nonce |
| **Chosen plaintext** | može šifrovati izabrani tekst | randomizovano šifrovanje (IV), otpornost algoritma |
| **Chosen ciphertext** | može dobiti dešifrovanje izabranih šifrata (oracle) | AEAD (GCM), generičke poruke greške, ujednačeno vrijeme (protiv padding oracle) |
| **Frequency analysis** | statistika pojavljivanja znakova | klasične supstitucione šifre su ranjive; moderni algoritmi sa difuzijom nisu |
| **Birthday attack** | traži kolizije hasha | dovoljno dug hash (SHA-256+), ne MD5/SHA-1 |
| **Meet-in-the-middle** | napada višestruko šifrovanje | razlog zašto 2DES ne donosi dvostruku sigurnost |
| **Replay** | ponovo šalje snimljenu poruku | nonce, timestampi, sekvencijski brojevi |

### Napadi na implementaciju i hardver

| Napad | Princip | Odbrana |
|---|---|---|
| **Implementation attacks** | greške u kodu, slab RNG, ponovljen nonce, loša provjera paddinga ili certifikata | validirane biblioteke, code review, testiranje, FIPS 140-3 |
| **Side-channel** | curenje kroz potrošnju energije (SPA/DPA), elektromagnetno zračenje, zvuk, keš | constant-time implementacije, maskiranje, oklop, TEMPEST |
| **Timing** | vrijeme izvršavanja zavisi od ključa ili podataka | operacije u konstantnom vremenu, blinding |
| **Fault injection** | izazivanje greške (napon, takt, laser, temperatura) da bi uređaj otkrio tajnu | tamper-responsive hardver (HSM), provjera rezultata prije izlaza, detekcija anomalija napajanja |
| **Cold boot** | čitanje ključeva iz RAM-a nakon gašenja | šifrovanje memorije, TPM+PIN, gašenje umjesto sleep |

### Napadi na protokole i identitet

| Napad | Princip | Odbrana |
|---|---|---|
| **Adversary-in-the-Middle (MITM/AitM)** | napadač se ubacuje između strana, presreće ili mijenja komunikaciju; AitM phishing krade session tokene | međusobna autentifikacija, validacija certifikata, pinning, HSTS, **phishing-resistant MFA (FIDO2)** |
| **Pass the hash** | korištenje ukradenog NTLM hasha umjesto lozinke | Credential Guard, LAPS, ograničenje admin prava, tiering model, isključenje NTLM-a, PAW |
| **Kerberos exploitation** | zloupotreba tiketa: kerberoasting (offline napad na servisne naloge), golden ticket (kompromitovan KRBTGT), silver ticket, pass the ticket | duge nasumične lozinke ili gMSA za servisne naloge, AES umjesto RC4, dvostruka rotacija KRBTGT nakon kompromitacije, monitoring anomalija tiketa |

### Savremene prijetnje u outlineu

| Prijetnja | Veza sa kriptografijom | Odbrana |
|---|---|---|
| **Ransomware** | napadač **koristi** jaku kriptografiju protiv žrtve (šifruje podatke), često uz krađu podataka (double extortion) | **offline/immutable backupi** i testiran oporavak, segmentacija, EDR, least privilege, patchovanje, IR plan |
| **Zero-day** | nepoznata ranjivost (i u kripto bibliotekama) bez zakrpe | defense in depth, segmentacija, EDR/ponašajna detekcija, virtuelno patchovanje, brz patch proces |
| **AI prijetnje** | **adversarial AI** (ulazi koji obmanjuju model), **model poisoning** (zatrovani podaci za treniranje), **deepfake** (lažni glas/video za prevaru) | integritet i porijeklo podataka za treniranje (potpisi, provenance), testiranje robusnosti, verifikacija zahtjeva drugim kanalom (callback), content credentials (C2PA potpisi) |

> **Na ispitu:** Za ransomware NAJBOLJA kontrola za oporavak je **offline ili immutable backup** koji je testiran; plaćanje otkupnine nije preporučeni odgovor. Za deepfake poziv „direktora“ koji traži hitnu uplatu, NAJBOLJA kontrola je **proces verifikacije drugim kanalom** (out-of-band callback), ne tehnologija za detekciju deepfakea.

## Primjeri računa

**Broj ključeva.** 50 zaposlenih treba međusobno povjerljivo komunicirati.

- Simetrično: 50 × 49 / 2 = **1.225** ključeva.
- Asimetrično: 2 × 50 = **100** ključeva.

**Key space.** Dodavanje jednog bita duplira prostor ključeva; AES-256 ima 2^128 puta više ključeva od AES-128.

**Grover.** AES-256 pod kvantnim napadom zadržava ~128 bita efektivne sigurnosti, pa se smatra post-kvantno sigurnim; AES-128 pada na ~64 bita.

**Birthday.** Hash od 128 bita (MD5) daje oko 2^64 pokušaja do kolizije, što je danas izvodljivo; SHA-256 daje 2^128.

## Scenariji

**Scenarij 1: ključ u repozitoriju.** Developer je slučajno objavio API ključ i privatni TLS ključ u javni Git repozitorij. Brisanje commita ne pomaže jer su ključevi već mogli biti kopirani. Ispravno: smatrati ključeve kompromitovanim, **opozvati certifikat** i rotirati sve tajne, istražiti logove upotrebe, uvesti secrets manager i skeniranje tajni u CI pipelineu.

**Scenarij 2: arhiva na 30 godina.** Arhiva potpisanih ugovora mora biti provjerljiva decenijama. Algoritmi potpisa će zastarjeti, a certifikati isteći. Rješenje: vremenski žigovi (trusted timestamping), periodično ponovno potpisivanje/arhivski potpisi sa jačim algoritmom, planiranje PQC prelaza, čuvanje lanca certifikata i statusa opoziva iz vremena potpisa.

**Scenarij 3: odlazak administratora ključeva.** Jedini administrator koji zna lozinku za HSM partition napušta firmu. Problem je nedostatak **M-of-N** i **key recovery** procesa. Kontrola za ubuduće: kvorum kartica raspoređen na više osoba, dokumentovana procedura oporavka, sef sa zapečaćenim dijelovima (split knowledge).

**Scenarij 4: interni servisi.** Mikroservisi komuniciraju preko interne mreže bez šifrovanja „jer je mreža pouzdana“. Po Zero Trust principu treba **mTLS** sa automatski rotiranim kratkoživućim certifikatima (service mesh ili interna PKI), jer napadač koji uđe u mrežu inače vidi i mijenja saobraćaj.

## Brzi izbor rješenja

| Zahtjev | Rješenje |
|---|---|
| šifrovanje velikih količina podataka | AES-GCM (simetrično) |
| razmjena ključa preko interneta | ECDHE (uz certifikat), ubuduće ML-KEM hibrid |
| neporecivost ugovora | digitalni potpis (RSA/ECDSA/ML-DSA) sa certifikatom |
| integritet fajla od pouzdanog izvora | hash objavljen preko pouzdanog kanala ili potpis |
| integritet i autentifikacija između dva servisa sa dijeljenom tajnom | HMAC |
| čuvanje lozinki | Argon2/bcrypt + salt |
| mobilni i IoT uređaji | ECC, lightweight kriptografija |
| ključevi CA i plaćanja | HSM, M-of-N |

## Brzi pregled pojmova

| Pojam | Jedna rečenica |
|---|---|
| Work factor | trud potreban za razbijanje; mora nadmašiti vrijednost i vijek podatka |
| AEAD | šifrovanje koje istovremeno daje povjerljivost i integritet (GCM, ChaCha20-Poly1305) |
| PFS | efemerni ključevi po sesiji; krađa dugoročnog ključa ne otkriva stare sesije |
| KEK / DEK | ključ koji šifruje ključeve / ključ koji šifruje podatke |
| Key escrow | kopija ključa kod pouzdane treće strane |
| OCSP stapling | server prilaže potpisani dokaz o statusu svog certifikata |
| Crypto agility | sposobnost zamjene algoritma bez redizajna sistema |
| Oracle | sistem koji odgovorom (npr. greškom) otkriva informaciju o dešifrovanju |

## Rezime

- Kriptografija pruža povjerljivost, integritet, autentifikaciju i neporecivost; **neporecivost samo potpis**.
- Simetrično: brzo, n(n−1)/2 ključeva, AES-GCM; izbjegavati ECB, DES, 3DES, RC4. Asimetrično: 2n ključeva, RSA, DH (samo razmjena), ECC (kraći ključevi); hibridni pristup i PFS.
- Hash: SHA-2/SHA-3, spori hashevi i salt za lozinke; HMAC daje integritet i autentifikaciju bez neporecivosti.
- Potpis: hash poruke potpisan privatnim ključem pošiljaoca, provjera javnim ključem.
- PQC: Shor razbija RSA/ECC, Grover polovi simetrične ključeve; FIPS 203/204/205 (ML-KEM, ML-DSA, SLH-DSA); inventar, crypto agility, hibridni prelaz.
- Životni ciklus ključa (SP 800-57): pre-operational, operational, post-operational, destroyed; cryptoperiod; algoritmi postaju deprecated pa disallowed.
- Upravljanje ključevima: HSM/KMS, odvojeno od podataka, rotacija, least privilege, split knowledge, dual control, escrow i recovery, envelope encryption.
- PKI: CA potpisuje, RA provjerava, CRL/OCSP opoziv, root offline; kompromitovan ključ → opoziv i novi par.
- Napadi (opisno): modeli po onome što napadač ima (ciphertext only, known/chosen plaintext/ciphertext), implementacijski i side-channel, MITM, pass the hash, Kerberos, ransomware (offline backupi), zero-day (defense in depth), AI prijetnje (provenance, verifikacija drugim kanalom).
