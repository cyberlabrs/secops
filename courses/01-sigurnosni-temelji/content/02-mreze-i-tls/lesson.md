## Mreža iz ugla sigurnosti

Kao DevOps inženjer znaš kako mreža radi. Security pogled dodaje tri pitanja: **šta je izloženo**, **ko s kim smije pričati** i **da li je saobraćaj zaštićen i vidljiv**.

## TCP/IP podsjetnik koji ti treba za security

| Sloj | Primjeri | Tipični napadi | Odbrana |
|---|---|---|---|
| L2 (link) | Ethernet, ARP, VLAN | ARP spoofing, VLAN hopping | port security, DAI, odvojeni VLAN-ovi |
| L3 (mreža) | IP, ICMP, rutiranje | IP spoofing, skeniranje | filtriranje ulaza i izlaza, anti-spoofing |
| L4 (transport) | TCP, UDP | SYN flood, skeniranje portova | SYN cookies, rate limit, firewall |
| L7 (aplikacija) | HTTP, DNS, SMTP | injekcije, zloupotreba API-ja | WAF, validacija, autentikacija |

**TCP three-way handshake:** `SYN` → `SYN-ACK` → `ACK`. Na tome počivaju skeniranja:

- **Connect scan** (`nmap -sT`): pravi pun handshake. Radi bez root-a, ali ostavlja trag u logovima aplikacije.
- **SYN scan** (`nmap -sS`): šalje SYN, a na SYN-ACK odgovara RST. Brži je, traži raw sockete (root).
- Stanja porta u nmapu: `open` (neko sluša), `closed` (host je odgovorio RST), `filtered` (nema odgovora, vjerovatno firewall).

> Skeniraj samo sisteme koje posjeduješ ili za koje imaš pisano odobrenje. Isto važi za sve alate iz ovog kursa.

### Prvo pitanje svakog pregleda: ko sluša?

```bash
ss -tulpn          # TCP i UDP portovi koji slušaju, sa procesom
ss -tnp state established
```

`0.0.0.0:5432` znači da baza sluša na **svim** interfejsima. `127.0.0.1:5432` znači samo lokalno. Razlika između ta dva je razlika između incidenta i mirnog sna.

## DNS

DNS prevodi imena u adrese i gotovo uvijek je dozvoljen kroz firewall, pa ga napadači vole.

- **DNS spoofing / cache poisoning**: lažni odgovor preusmjerava žrtvu. Odbrana: **DNSSEC** (potpisani zapisi) i resolveri koji ga provjeravaju.
- **DNS tunelovanje**: podaci se iznose kroz poddomene (`aGVsbG8.napadac.com`). Detekcija: neobično duga imena, velik broj upita ka jednom domenu, visoka entropija.
- **Subdomain takeover**: CNAME pokazuje na obrisani cloud resurs, pa ga napadač registruje. Odbrana: inventar DNS zapisa i čišćenje.
- **DoH/DoT** (DNS preko HTTPS/TLS) štite privatnost, ali i zaobilaze korporativni DNS nadzor.

## TLS i PKI

TLS daje tri stvari: **povjerljivost** (enkripcija), **integritet** (podaci nisu izmijenjeni) i **autentičnost servera** (certifikat).

### Kako se certifikat provjerava

1. Server šalje svoj certifikat i **intermediate** certifikate (lanac).
2. Klijent gradi lanac do **root CA** kojem vjeruje (trust store u OS-u ili browseru).
3. Provjerava: potpis svakog karika, rok važenja, da ime hosta odgovara **SAN** polju (Subject Alternative Name; CN se više ne koristi za ovo), i status opoziva.

Najčešća greška u praksi: server ne šalje intermediate certifikat. Browser ponekad to „popravi“ sam, a `curl` i aplikacije padaju.

### Verzije i postavke

| Stavka | Preporuka (Mozilla „intermediate“ profil) |
|---|---|
| Verzije | TLS 1.2 i 1.3; SSL, TLS 1.0 i 1.1 isključeni |
| Razmjena ključeva | ECDHE (forward secrecy) |
| Šifre | AEAD: AES-GCM, ChaCha20-Poly1305 |
| HSTS | `Strict-Transport-Security: max-age=63072000` kad si siguran da sve radi preko HTTPS-a |
| Certifikati | automatizovano izdavanje i obnova (ACME, cert-manager) |

**Forward secrecy** znači: ako neko kasnije ukrade privatni ključ servera, ne može dešifrovati ranije snimljen saobraćaj, jer su ključevi sesija bili privremeni (ephemeral).

**mTLS** (mutual TLS): i klijent pokazuje certifikat. Standard za komunikaciju servis-servis (service mesh: Istio, Linkerd).

### openssl komande koje se stalno koriste

```bash
openssl s_client -connect host:443 -servername host </dev/null   # pogledaj lanac i verziju
openssl x509 -in cert.pem -noout -text                             # detalji certifikata
openssl x509 -in cert.pem -noout -enddate -ext subjectAltName
openssl verify -CAfile ca.pem -untrusted intermediate.pem cert.pem
```

## Segmentacija

Ravna mreža znači: kad napadač uđe na jedan sistem, vidi sve. Segmentacija ograničava **lateralno kretanje**.

- **Mrežni nivo**: VPC/VNet podmreže, security grupe, NSG, firewall između zona (javna, aplikacijska, baza).
- **Mikrosegmentacija**: pravila po radnom opterećenju, ne po podmreži. U Kubernetesu je to `NetworkPolicy` (podrazumijevano je sve dozvoljeno dok ne dodaš politiku).
- **Egress kontrola**: ograniči i **izlazni** saobraćaj. Većina malvera mora „zvati kući“; server baze nema razloga otvarati konekcije prema internetu.

Pravilo: **deny by default**, pa dozvoli tačno ono što treba.

## WAF

Web Application Firewall pregleda HTTP zahtjeve i blokira poznate obrasce napada (SQLi, XSS, path traversal) prije nego stignu do aplikacije. Primjeri: AWS WAF, Azure WAF, Cloudflare, ModSecurity sa **OWASP Core Rule Set**.

- WAF je **dodatni sloj**, a ne zamjena za siguran kod.
- Kreni u režimu *detection/count*, analiziraj lažne pozitive, pa pređi na *block*.

## Zero trust

Stari model: „unutar mreže = povjerljivo“. Zero trust (NIST SP 800-207): **lokacija na mreži ne daje povjerenje**. Svaki zahtjev se provjerava.

Principi:

1. Provjeri eksplicitno: identitet korisnika **i** stanje uređaja, za svaki zahtjev.
2. Najmanje privilegije i pristup „taman na vrijeme“ (*just-in-time*).
3. Pretpostavi proboj (*assume breach*): segmentiraj, šifruj interni saobraćaj, prati sve.

U praksi: SSO + MFA, Conditional Access, identity-aware proxy umjesto VPN-a za cijelu mrežu, mTLS između servisa.

## Rezime

- Znaj šta sluša (`ss -tulpn`) i zašto.
- TLS 1.2+ s forward secrecy, ispravan lanac, SAN i automatska obnova.
- Segmentiraj i kontroliši izlaz; deny by default.
- WAF i zero trust su slojevi, ne čarobna rješenja.
