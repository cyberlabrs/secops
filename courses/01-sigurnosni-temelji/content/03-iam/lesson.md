## Identitet je nova granica

U cloudu nema jasnog „unutra“ i „vani“. Ko ima validan token ili ključ, pristupa resursu odakle god. Zato je IAM danas najvažnija sigurnosna kontrola, a pogrešno podešene dozvole i ukradeni kredencijali su među najčešćim uzrocima cloud incidenata.

## Autentikacija i autorizacija

| | Autentikacija (AuthN) | Autorizacija (AuthZ) |
|---|---|---|
| Pitanje | **Ko si ti?** | **Šta smiješ?** |
| Primjeri | lozinka, ključ, certifikat, MFA, token | IAM politika, RBAC uloga, ACL |
| Greška | napadač se predstavi kao ti | prijavljen korisnik radi više nego što treba |

Treći dio je **accounting / audit**: zapis o tome ko je šta uradio (CloudTrail, Azure Activity Log, auth.log). Zajedno se zovu **AAA**.

## Najmanje privilegije

Svaki identitet (čovjek, servis, CI pipeline) dobija samo ono što mu treba, samo onoliko dugo koliko mu treba.

- Počni od **ničega** i dodaj, umjesto da kreneš od admina i oduzimaš.
- Koristi alate koji predlažu politike na osnovu stvarne upotrebe (AWS IAM Access Analyzer, Azure Entra permissions management).
- **Just-in-time (JIT)** pristup: privilegovana uloga se aktivira na zahtjev i ističe (Azure PIM, AWS Identity Center sa privremenim pristupom).
- **Odvajanje dužnosti** (*separation of duties*): ista osoba ne bi trebala i napisati i odobriti i pustiti promjenu u produkciju.

## Modeli kontrole pristupa

| Model | Ideja | Primjer |
|---|---|---|
| **DAC** (discretionary) | vlasnik resursa odlučuje | Linux dozvole fajlova |
| **MAC** (mandatory) | sistem nameće pravila po oznakama | SELinux, AppArmor, vojne klasifikacije |
| **RBAC** (role-based) | prava se daju ulogama, korisnici dobijaju uloge | Kubernetes RBAC, Azure RBAC |
| **ABAC** (attribute-based) | odluka po atributima korisnika, resursa i konteksta | AWS politike sa tagovima i `Condition` |
| **ReBAC** (relationship-based) | odluka po vezi između entiteta | Google Zanzibar, OpenFGA („vlasnik dokumenta“) |

RBAC je jednostavan za razumijevanje, ali uloge se brzo umnožavaju (*role explosion*). ABAC se bolje skalira, ali ga je teže provjeriti.

## Federacija i SSO

Umjesto da svaka aplikacija čuva lozinke, **identity provider (IdP)** potvrđuje identitet, a aplikacija (**service provider / relying party**) vjeruje IdP-u.

| Protokol | Za šta | Format | Tipična upotreba |
|---|---|---|---|
| **SAML 2.0** | autentikacija (SSO) | XML assertion | enterprise SaaS, starije web aplikacije |
| **OAuth 2.0** | **delegirana autorizacija** | access token | API pristup u ime korisnika |
| **OIDC** | autentikacija **nad** OAuth 2.0 | ID token (JWT) | moderne web i mobilne aplikacije, CI/CD |

> Česta greška: OAuth 2.0 sam po sebi **nije** protokol za prijavu. Access token kaže šta klijent smije, a ne ko je korisnik. Za identitet služi OIDC i njegov ID token.

### OIDC u CI/CD-u (workload identity federation)

Umjesto dugotrajnih cloud ključeva u GitHub secrets, pipeline dobija kratkotrajan OIDC token od GitHuba, a AWS/Azure/GCP ga razmijeni za privremene kredencijale. Nema statičnog ključa koji može procuriti. Ovo je danas preporučena praksa.

Pazi na uslove povjerenja: ograniči `sub` claim na tačan repo i granu (npr. `repo:firma/app:ref:refs/heads/main`), inače bi bilo koji repo mogao preuzeti ulogu.

### JWT ukratko

JWT ima tri dijela: `header.payload.signature`, svaki u base64url kodu. Payload je **čitljiv svakome**, jer je samo kodiran, a ne šifrovan. Server mora:

- provjeriti potpis i dozvoliti samo očekivani algoritam (nikad `alg: none`),
- provjeriti `exp`, `iss` i `aud`,
- ne stavljati tajne u payload.

## MFA

Faktori: nešto što **znaš** (lozinka), nešto što **imaš** (telefon, ključ), nešto što **jesi** (biometrija). Dva faktora iste vrste nisu MFA.

Nisu sve MFA metode jednako jake:

| Metoda | Otpornost na phishing |
|---|---|
| SMS / glasovni poziv | slaba (SIM swap, presretanje) |
| TOTP aplikacija (6 cifara) | srednja: korisnik i dalje može kucati kod na lažnoj stranici |
| Push notifikacija | srednja: MFA fatigue napadi („spam“ zahtjeva dok korisnik ne odobri); pomaže number matching |
| **FIDO2 / WebAuthn / passkeys** | **jaka**: ključ je vezan za domen i neće se potpisati na lažnom sajtu |

Za admin naloge cilj je **phishing-resistant MFA** (FIDO2 ključevi ili passkeys).

## Lozinke danas (NIST SP 800-63B)

- Dužina iznad složenosti: minimum 8 znakova, a bolje 15+. Dozvoli dugačke fraze.
- **Ne** traži periodičnu promjenu bez razloga; mijenja se kad postoji dokaz kompromitacije.
- Provjeravaj nove lozinke protiv lista procurjelih (npr. Have I Been Pwned k-anonymity API).
- Bez sigurnosnih pitanja („ime ljubimca“).

## Servisni identiteti i tajne

Mašinskih identiteta je danas mnogo više nego ljudskih.

- Koristi **managed identities / IAM uloge / workload identity** umjesto statičnih ključeva.
- Ako ključ mora postojati: čuvaj ga u vaultu (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault), rotiraj ga i nikad ga ne commitaj u git.
- Svaki servis ima **svoj** identitet; dijeljeni nalog uništava audit trag.

## Životni ciklus naloga (Joiner, Mover, Leaver)

| Faza | Šta mora da se desi | Tipičan propust |
|---|---|---|
| **Joiner** | nalog iz HR sistema, uloga prema poziciji | ručno kopiranje prava „kao kolega X“ |
| **Mover** | stara prava se **uklanjaju**, nova dodaju | gomilanje prava (*privilege creep*) |
| **Leaver** | nalog se zaključava odmah, ključevi i tokeni se opozivaju | aktivni SSH ključevi i API tokeni bivšeg zaposlenog |

Periodične **revizije pristupa** (*access reviews*) hvataju ono što je promaklo: vlasnik resursa potvrđuje da li svaka osoba i dalje treba pristup.

**Break-glass nalozi**: jedan ili dva hitna admin naloga koji ne zavise od SSO-a, s jakom lozinkom u sefu i alarmom na svaku prijavu.

## Rezime

- Identitet je granica. AuthN potvrđuje ko je neko, AuthZ određuje šta smije.
- Najmanje privilegije, JIT pristup i odvajanje dužnosti.
- OIDC za prijavu i federaciju u CI/CD, OAuth 2.0 za delegiranje, SAML u enterprise okruženjima.
- Phishing-resistant MFA za privilegovane naloge.
- Joiner, Mover, Leaver procesi i redovne revizije pristupa.
