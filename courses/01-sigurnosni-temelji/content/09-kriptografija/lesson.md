## Kodiranje, hash, enkripcija

Tri stvari koje se stalno miješaju:

| | Svrha | Može li se vratiti? | Ključ? | Primjer |
|---|---|---|---|---|
| **Kodiranje** | prenos/format podataka | da, svako | ne | Base64, URL encoding, hex |
| **Hash** | otisak podataka, integritet | ne (jednosmjerno) | ne | SHA-256, SHA-3 |
| **Enkripcija** | povjerljivost | da, ali samo sa ključem | da | AES-GCM, RSA-OAEP |

> Base64 **nije** zaštita. Kubernetes `Secret` objekti su po defaultu samo base64 kodirani u etcd-u. Za stvarnu zaštitu treba enkripcija etcd-a (KMS provider) ili eksterni secrets manager.

## Hash funkcije

Dobra kriptografska hash funkcija:

- daje izlaz fiksne dužine (SHA-256: 256 bita),
- je jednosmjerna: iz hash-a se ne može dobiti ulaz,
- je otporna na kolizije: praktično je nemoguće naći dva ulaza sa istim hash-om,
- ima efekat lavine: promjena jednog bita mijenja pola izlaza.

| Algoritam | Status |
|---|---|
| MD5 | **probijen** (kolizije za sekunde). Samo za ne-sigurnosne checksume. |
| SHA-1 | **probijen** (praktične kolizije od 2017). Git ga i dalje koristi kao identifikator, ali prelazi na SHA-256. |
| SHA-256 / SHA-512 (SHA-2) | siguran, standard |
| SHA-3, BLAKE2/BLAKE3 | sigurni |

Upotreba: provjera integriteta preuzetih fajlova (`sha256sum -c`), content-addressable storage (Docker image digest `sha256:…`), potpisi (potpisuje se hash).

### HMAC

Običan hash ne dokazuje **ko** je napravio poruku: svako može izračunati SHA-256. **HMAC** (hash + tajni ključ) daje integritet **i** autentičnost između strana koje dijele ključ. Koriste ga webhookovi (GitHub `X-Hub-Signature-256`), JWT HS256 i AWS potpisivanje zahtjeva (SigV4).

Poređenje HMAC vrijednosti radi se funkcijom **konstantnog vremena** (`hmac.compare_digest`), da napadač ne bi mjerenjem vremena odgovora pogađao bajt po bajt.

### Hash lozinki

Lozinke se hash-uju **namjerno sporim** algoritmima sa **solju** (*salt*):

- **Argon2id** (preporuka OWASP-a), scrypt, bcrypt, PBKDF2 (kad je potrebna FIPS usklađenost).
- So je slučajna vrijednost po korisniku. Isti password ne daje isti hash, pa rainbow tabele ne pomažu.
- „Pepper“ je dodatna tajna van baze (npr. u HSM-u ili KMS-u).

## Simetrična kriptografija

Isti ključ šifruje i dešifruje. Brza je, pa se koristi za podatke.

- **AES** (blok šifra, 128 ili 256-bitni ključ) u modu **GCM**, ili **ChaCha20-Poly1305**. Oba su **AEAD** (Authenticated Encryption with Associated Data): daju povjerljivost **i** integritet. Izmijenjen šifrat se odbija pri dešifrovanju.
- Izbjegavaj **ECB** (isti blokovi teksta daju iste blokove šifrata, poznati „ECB pingvin“) i CBC bez MAC-a.
- **Nonce/IV** se **nikad ne smije ponoviti** sa istim ključem u GCM-u. Ponovljen nonce u GCM-u je katastrofa: curi XOR otvorenih tekstova i omogućava falsifikovanje.

Problem simetrične kriptografije je **distribucija ključa**: kako da obje strane dobiju isti ključ, a da ga niko ne presretne?

## Asimetrična kriptografija

Par ključeva: **javni** (dijeli se slobodno) i **privatni** (nikad ne napušta vlasnika).

| Operacija | Ko koristi koji ključ | Svrha |
|---|---|---|
| Enkripcija | pošiljalac šifruje **javnim** ključem primaoca; samo **privatni** dešifruje | povjerljivost |
| Potpis | vlasnik potpisuje **privatnim**; svako provjerava **javnim** | autentičnost, integritet, neporecivost |
| Razmjena ključa (ECDH) | obje strane izvedu isti tajni ključ iz svojih privatnih i tuđih javnih ključeva | dogovor simetričnog ključa preko nesigurnog kanala |

Algoritmi: **RSA** (2048+ bita, za enkripciju OAEP padding, za potpis PSS), **ECDSA** (P-256), **Ed25519** (moderan, brz, teško ga je pogrešno upotrijebiti), **X25519** za razmjenu ključeva.

Asimetrična kriptografija je spora, pa se u praksi kombinuje sa simetričnom (**hibridna enkripcija**): asimetrično se dogovori ili zaštiti simetrični ključ, a simetrično se šifruju podaci. Tako radi TLS.

## Digitalni potpisi u DevOps-u

- **Commitovi** potpisani SSH ili GPG ključem (GitHub „Verified“).
- **Artefakti i slike kontejnera**: Sigstore/cosign (keyless potpisivanje preko OIDC identiteta i transparency loga Rekor).
- **Paketi**: apt i rpm repozitoriji su potpisani. Zato `curl … | sudo bash` zaobilazi zaštitu koju paket-menadžer inače daje.
- Kubernetes admission politike (Kyverno, Sigstore policy-controller) mogu dozvoliti samo potpisane slike.

## Upravljanje ključevima

Kriptografija je obično jaka. Ključevi su slaba tačka.

- **KMS** (AWS KMS, Azure Key Vault, GCP KMS) i **HSM**: ključ nikad ne izlazi iz servisa, a svaka upotreba je logovana i podložna IAM politikama.
- **Envelope enkripcija**: podaci se šifruju **data key-em (DEK)**, a DEK se šifruje **master ključem (KEK)** u KMS-u. Čuvaš šifrovane podatke i šifrovani DEK. Za dešifrovanje KMS dešifruje DEK, i to samo uz dozvolu i uz trag u logu. Rotacija KEK-a ne zahtijeva ponovno šifrovanje svih podataka.
- **Rotacija**: redovna (npr. godišnje za KEK; KMS to radi automatski) i odmah nakon sumnje na kompromitaciju.
- **Odvajanje dužnosti**: ko administrira ključ, ne bi trebao imati pristup podacima, i obratno.
- **Crypto-shredding**: brisanjem ključa podaci postaju nečitljivi, što je korisno za GDPR brisanje iz backupa.

## Nasumičnost

Ključevi, nonce-ovi, tokeni sesija i soli moraju doći iz **kriptografski sigurnog** generatora (CSPRNG): `/dev/urandom`, `getrandom()`, `secrets` u Pythonu, `crypto.randomBytes` u Node-u. Nikad iz `random()` ili `Math.random()`.

## Post-kvantna kriptografija (PQC)

Dovoljno veliki kvantni računar mogao bi Shorovim algoritmom probiti **RSA i ECC** (razmjenu ključeva i potpise). Simetrična kriptografija i hash funkcije su znatno manje pogođeni: AES-256 i SHA-256/384 ostaju upotrebljivi.

- NIST je u avgustu 2024. objavio prve PQC standarde: **FIPS 203 ML-KEM** (razmjena ključeva, ranije Kyber), **FIPS 204 ML-DSA** (potpisi, ranije Dilithium) i **FIPS 205 SLH-DSA** (potpisi zasnovani na hash funkcijama).
- Prijetnja **„harvest now, decrypt later“**: napadač danas snima šifrovan saobraćaj i dešifruje ga kad kvantni računari budu dostupni. Zato se razmjena ključeva migrira prva.
- Browseri i veliki CDN-ovi već koriste **hibridnu** razmjenu ključeva u TLS 1.3 (X25519 + ML-KEM-768), a OpenSSH koristi hibridni PQ algoritam kao podrazumijevani od verzije 10.0.
- Šta raditi danas: napraviti **inventar kriptografije** (gdje se koriste RSA i ECC, koliko dugo podaci moraju ostati tajni) i težiti **kripto-agilnosti** (algoritam se može zamijeniti konfiguracijom, a ne prepisivanjem koda).

## Česte greške

- Pisanje vlastite kriptografije ili protokola. Koristi provjerene biblioteke (libsodium, Tink, standardne biblioteke jezika).
- Ključevi i lozinke u kodu, Docker slikama ili env fajlovima u gitu.
- Isključena provjera certifikata (`verify=False`, `curl -k`, `InsecureSkipVerify: true`) koja ostane u produkciji.
- Ponovljen nonce, ECB mod, MD5/SHA-1 za sigurnost, brz hash za lozinke.

## Rezime

- Kodiranje nije zaštita. Hash je za integritet, HMAC za integritet i autentičnost, enkripcija za povjerljivost.
- AES-GCM ili ChaCha20-Poly1305 za podatke; Ed25519, ECDSA ili RSA-PSS za potpise; X25519 za razmjenu ključeva.
- Lozinke: Argon2id sa solju.
- Ključevi u KMS-u, envelope enkripcija, rotacija.
- PQC: ML-KEM i ML-DSA su standardi; počni sa inventarom i kripto-agilnošću.
