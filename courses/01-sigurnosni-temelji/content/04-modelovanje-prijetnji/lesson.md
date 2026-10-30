## Šta je modelovanje prijetnji

Modelovanje prijetnji je strukturisano razmišljanje o tome šta može poći po zlu **prije** nego što se desi. Najjeftinije je u fazi dizajna: popravka na tabli košta minut, a ista popravka u produkciji košta sprint ili incident.

Adam Shostack ga svodi na **četiri pitanja** (Threat Modeling Manifesto):

1. **Na čemu radimo?** Nacrtaj sistem.
2. **Šta može poći po zlu?** Pronađi prijetnje (STRIDE).
3. **Šta ćemo uraditi povodom toga?** Kontrole, prihvatanje rizika, redizajn.
4. **Jesmo li dobro uradili posao?** Provjeri, testiraj, ažuriraj model.

Ne treba ti savršen model. Treba ti model koji tim stvarno koristi i ažurira kad se arhitektura promijeni.

## Dijagram toka podataka (DFD)

DFD ima samo pet elemenata:

| Element | Oznaka | Primjer |
|---|---|---|
| **Vanjski entitet** | pravougaonik | korisnik, partnerski API, IdP |
| **Proces** | krug | web aplikacija, Lambda funkcija, worker |
| **Skladište podataka** | dvije paralelne linije | baza, S3 bucket, red poruka |
| **Tok podataka** | strelica | HTTPS zahtjev, SQL upit, poruka |
| **Granica povjerenja** | isprekidana linija | internet / VPC, aplikacija / baza, korisnik / admin |

**Granice povjerenja** (*trust boundaries*) su mjesta gdje se mijenja nivo povjerenja. Tu se dešava većina napada, pa tu tražiš prijetnje najpažljivije. Svaki tok koji prelazi granicu mora imati odgovor na pitanja: ko je pošiljalac, da li je sadržaj validiran, da li je kanal zaštićen.

```text
 [Korisnik] --HTTPS--> | (Web API) --SQL--> ||Baza||
                       |      \
   granica: internet   |       \--poruka--> ||Red|| --> (Worker) --> [Email servis]
```

## STRIDE

STRIDE je Microsoftova mnemonika za šest kategorija prijetnji. Svaka je suprotnost jednom sigurnosnom svojstvu.

| Slovo | Prijetnja | Narušeno svojstvo | Primjer | Tipične kontrole |
|---|---|---|---|---|
| **S** | Spoofing (lažno predstavljanje) | autentičnost | ukraden session cookie, lažni servis | jaka autentikacija, MFA, mTLS, potpisani tokeni |
| **T** | Tampering (izmjena) | integritet | izmjena cijene u zahtjevu, izmjena fajla na disku | validacija na serveru, potpisi, hash, kontrola pristupa za pisanje |
| **R** | Repudiation (poricanje) | neporecivost | „nisam ja odobrio tu uplatu“ i nema loga | audit log otporan na izmjene, potpisane transakcije |
| **I** | Information disclosure (curenje) | povjerljivost | javni S3 bucket, stack trace sa lozinkom | enkripcija, najmanje privilegije, maskiranje grešaka |
| **D** | Denial of service | dostupnost | preplavljivanje API-ja, skup upit bez limita | rate limiting, kvote, autoscaling, timeouti |
| **E** | Elevation of privilege | autorizacija | običan korisnik poziva admin endpoint | provjera autorizacije na svakom zahtjevu, sandboxing |

### STRIDE po elementu

Nisu sve kategorije relevantne za svaki element DFD-a:

| Element | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| Vanjski entitet | ✔ | | ✔ | | | |
| Proces | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Skladište podataka | | ✔ | ✔* | ✔ | ✔ | |
| Tok podataka | | ✔ | | ✔ | ✔ | |

\* repudiation za skladište važi kad ono čuva audit logove.

Ovo ti daje sistematičan postupak: prođi kroz svaki element i za njega relevantna slova.

## Od prijetnje do odluke

Za svaku prijetnju postoje četiri odgovora:

1. **Ublaži** (*mitigate*): dodaj kontrolu. Najčešće.
2. **Eliminiši**: ukloni funkcionalnost ili komponentu.
3. **Prenesi**: npr. osiguranje, ili prepusti dio odgovornosti provajderu (managed servis).
4. **Prihvati**: svjesna, dokumentovana odluka vlasnika rizika.

Za prioritet je dovoljna jednostavna procjena **vjerovatnoće × uticaja** (nizak, srednji, visok). DREAD je stariji model bodovanja koji se danas rijetko preporučuje jer je subjektivan.

## Rezultat modelovanja

Koristan izlaz je tabela koju tim može pratiti:

| # | Element | STRIDE | Prijetnja | Kontrola | Status |
|---|---|---|---|---|---|
| 1 | Web API | S | ukraden JWT se koristi sa drugog uređaja | kratak `exp`, refresh token rotacija | urađeno |
| 2 | Tok API→Baza | I | saobraćaj ka bazi nije šifrovan | TLS na konekciji, `sslmode=verify-full` | u toku |
| 3 | Red poruka | T | bilo koji servis može upisati poruku | IAM politika: samo Web API piše | otvoreno |

Prijetnje bez kontrole postaju tiketi u backlogu, sa vlasnikom.

## Drugi pristupi, ukratko

- **PASTA**: proces u sedam faza, fokusiran na rizik za biznis.
- **LINDDUN**: prijetnje privatnosti (povezivost, identifikacija, curenje podataka o ličnosti…).
- **Attack trees**: cilj napadača je korijen stabla, a grane su načini da se do njega dođe.
- **MITRE ATT&CK**: koristan za realne tehnike napadača kad modeluješ infrastrukturu (sljedeći moduli).

Alati: papir i tabla, OWASP Threat Dragon, Microsoft Threat Modeling Tool, threat modeling as code (pytm, Threagile).

## Rezime

- Četiri pitanja: šta gradimo, šta može poći po zlu, šta ćemo uraditi, jesmo li dobro uradili.
- DFD sa granicama povjerenja je osnova; prijetnje se gomilaju na granicama.
- STRIDE prođi sistematično, po elementima.
- Svaka prijetnja dobija odluku i vlasnika. Model se ažurira sa arhitekturom.
