## OWASP i zašto je Top 10 bitan

**OWASP** (Open Worldwide Application Security Project) je neprofitna zajednica koja objavljuje besplatne standarde i alate. **OWASP Top 10** je dokument o svijesti (*awareness*), a ne kompletan standard: deset najvažnijih kategorija rizika za web aplikacije, sastavljenih iz podataka o testiranju i ankete zajednice.

Aktuelno izdanje je **OWASP Top 10:2025**, osmo po redu, koje je zamijenilo verziju iz 2021. Za detaljnu provjeru aplikacije postoji **OWASP ASVS** (Application Security Verification Standard), a za praktične savjete **Cheat Sheet Series**.

## OWASP Top 10:2025

| # | Kategorija | Ukratko |
|---|---|---|
| A01 | **Broken Access Control** | korisnik radi ili vidi više nego što smije; od 2025. uključuje i SSRF |
| A02 | **Security Misconfiguration** | podrazumijevane lozinke, debug u produkciji, preširoke CORS/cloud postavke |
| A03 | **Software Supply Chain Failures** | ranjive ili kompromitovane zavisnosti, build sistemi, registri (novo, šire od starog „Vulnerable Components“) |
| A04 | **Cryptographic Failures** | podaci bez enkripcije, slabi algoritmi, loše upravljanje ključevima |
| A05 | **Injection** | SQL, NoSQL, OS komande, LDAP, XSS: podaci se tumače kao kod |
| A06 | **Insecure Design** | greška u samom dizajnu, ne u implementaciji (npr. nema limita na reset lozinke) |
| A07 | **Authentication Failures** | slabe lozinke, credential stuffing, loše upravljanje sesijama |
| A08 | **Software or Data Integrity Failures** | nepotpisana ažuriranja, nesigurna deserijalizacija, CI/CD bez provjere integriteta |
| A09 | **Security Logging & Alerting Failures** | napad se ne bilježi ili se ne alarmira (2025. ističe i alarmiranje) |
| A10 | **Mishandling of Exceptional Conditions** | loše obrađene greške: *fail open*, curenje detalja, nekonzistentno stanje (novo) |

Šta se promijenilo u odnosu na 2021:

- **Novo:** A03 Software Supply Chain Failures i A10 Mishandling of Exceptional Conditions.
- **SSRF** više nije posebna kategorija, nego je dio A01.
- Security Misconfiguration je skočio sa 5. na 2. mjesto.

## Najvažnije kategorije u kodu

### A01 Broken Access Control

Najčešći oblik je **IDOR** (Insecure Direct Object Reference): aplikacija uzme ID iz zahtjeva i vrati objekat, a ne provjeri pripada li tom korisniku.

```python
# ranjivo
order = db.get_order(request.args["id"])
# ispravno: vlasništvo je dio upita
order = db.get_order(id=request.args["id"], owner=current_user.id)
```

Pravila: **deny by default**, provjera na serveru za **svaki** zahtjev, autorizacija na nivou objekta, a ne samo rute. Skrivanje dugmeta u UI-ju nije kontrola pristupa.

**SSRF**: server preuzima URL koji je zadao korisnik i tako može doći do internih adresa, npr. cloud metadata servisa na `169.254.169.254`. Odbrana: lista dozvoljenih odredišta, blokiranje privatnih opsega, **IMDSv2** na AWS-u, egress kontrola.

### A05 Injection

Uzrok je uvijek isti: **podatak i kod su pomiješani u istom stringu**.

```python
# ranjivo: unos postaje dio SQL-a
cur.execute(f"SELECT * FROM users WHERE name = '{name}'")
# ispravno: parametrizovan upit, baza zna šta je podatak
cur.execute("SELECT * FROM users WHERE name = ?", (name,))
```

- SQL: parametrizovani upiti ili ORM (bez ručnog spajanja stringova).
- OS komande: izbjegavaj shell; `subprocess.run([...], shell=False)`.
- XSS: kontekstualno escapovanje izlaza (template engine to radi automatski) i **Content-Security-Policy**.
- Validacija ulaza je dodatni sloj, a ne zamjena za parametrizaciju.

### A02 Security Misconfiguration

Tipični nalazi: debug mod u produkciji, podrazumijevani admin nalozi, nepotrebni servisi i portovi, `Access-Control-Allow-Origin: *` uz kredencijale, javni bucketi, nedostajuća sigurnosna HTTP zaglavlja. Odbrana je **ponovljiv, automatizovan hardening** (IaC + skeneri kao Checkov i Trivy) i iste postavke u svim okruženjima.

### A03 Software Supply Chain Failures

- Inventar zavisnosti (**SBOM**) i skeneri (Dependabot, Renovate, Trivy, osv-scanner).
- Zaključane verzije (lock fajlovi), provjera hash-eva, privatni mirror.
- Pazi na **typosquatting** i **dependency confusion** (interno ime paketa objavljeno javno).
- Potpisivanje artefakata (Sigstore/cosign) i SLSA nivoi za build.

### A04 Cryptographic Failures

- TLS svuda; enkripcija osjetljivih podataka u mirovanju.
- Lozinke se **ne šifruju nego hash-uju** sporim algoritmom: **Argon2id**, scrypt ili bcrypt. Nikad MD5/SHA-1/SHA-256 bez soli i bez faktora rada.
- Ključevi u KMS-u ili vaultu, ne u kodu.

### A07 Authentication Failures

Credential stuffing (procurjeli parovi email/lozinka sa drugih sajtova), nema ograničenja pokušaja, sesije koje ne ističu, ID sesije u URL-u. Odbrana: MFA, rate limiting, provjera protiv procurjelih lozinki, nova sesija nakon prijave.

### A10 Mishandling of Exceptional Conditions

Kada nešto pukne, sistem mora **pasti zatvoren** (*fail closed*):

```python
# ranjivo: ako servis za ovlasti ne odgovori, svi postaju admini
def is_admin(user):
    try:
        return authz.check(user, "admin")
    except Exception:
        return True
```

Uz to: generičke poruke korisniku, detalji samo u internim logovima, transakcije koje se vraćaju u konzistentno stanje.

## OWASP API Security Top 10 (2023)

API-ji imaju svoju listu jer im je tipičan problem autorizacija nad objektima i poljima:

| # | Rizik | Ukratko |
|---|---|---|
| API1 | **Broken Object Level Authorization (BOLA)** | IDOR za API: `/orders/123` vraća tuđu narudžbu |
| API2 | Broken Authentication | slabi tokeni, nema limita na prijavu |
| API3 | Broken Object Property Level Authorization | API vraća ili prihvata polja koja ne bi smio (*mass assignment*, `"isAdmin": true`) |
| API4 | Unrestricted Resource Consumption | nema limita na veličinu, broj zahtjeva ili trošak (SMS, AI pozivi) |
| API5 | Broken Function Level Authorization | običan korisnik poziva admin funkciju |
| API6 | Unrestricted Access to Sensitive Business Flows | automatizovana zloupotreba legitimnog toka (kupovina svih karata botom) |
| API7 | Server Side Request Forgery | API preuzima URL koji je zadao korisnik |
| API8 | Security Misconfiguration | CORS, verbose greške, nedostajući TLS |
| API9 | Improper Inventory Management | zaboravljene `v1` ili test verzije API-ja |
| API10 | Unsafe Consumption of APIs | slijepo povjerenje u odgovore API-ja treće strane |

## Gdje ovo ulazi u DevSecOps

| Alat | Hvata |
|---|---|
| SAST (Semgrep, CodeQL) | injekcije, opasne funkcije, hardkodovane tajne u kodu |
| SCA (Trivy, Dependabot, osv-scanner) | A03: ranjive zavisnosti |
| Secret scanning (gitleaks, trufflehog) | tajne u repou |
| DAST (OWASP ZAP) | misconfiguration, nedostajuća zaglavlja, dio injekcija u pokrenutoj aplikaciji |
| IaC skeneri (Checkov, Trivy config) | A02 u Terraformu i Kubernetes manifestima |

BOLA/IDOR i logičke greške skeneri **rijetko** nalaze. Za njih trebaju code review, testovi autorizacije i modelovanje prijetnji.

## Rezime

- Top 10:2025: A01 Broken Access Control je i dalje na prvom mjestu; novi su Supply Chain (A03) i Exceptional Conditions (A10).
- Injection se rješava parametrizacijom, a ne filtriranjem.
- Kontrola pristupa na serveru, po objektu, deny by default.
- Lozinke se hash-uju Argon2id/bcrypt algoritmom, sistemi padaju zatvoreni.
