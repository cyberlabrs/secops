## Ciljevi ispita: 2.1, 2.2 i 2.3

Domen 2 (**Cloud Data Security**) je najteži domen ispita sa oko 20%. Ovaj modul pokriva prva tri cilja:

- **2.1 Describe cloud data concepts**
  - faze životnog ciklusa podataka u cloudu (cloud data lifecycle phases),
  - disperzija podataka (data dispersion),
  - tokovi podataka (data flows).
- **2.2 Design and implement cloud data storage architectures**
  - tipovi storagea (long-term, ephemeral, raw storage, object storage, volume storage),
  - prijetnje po tipovima storagea.
- **2.3 Design and apply data security technologies and strategies**
  - šifrovanje i upravljanje ključevima,
  - tokenizacija,
  - hashing (integritet podataka, nonrepudiation),
  - Data Loss Prevention (DLP),
  - obfuskacija podataka (masking, anonymization),
  - upravljanje ključevima, tajnama i certifikatima.

Na ispitu se ovdje često traži **izbor prave tehnike za scenario**: kada tokenizacija, a kada šifrovanje; kada maskiranje, a kada anonimizacija; zašto hash nije šifrovanje. Uz modul ide lab **Envelope enkripcija i crypto-shredding**, gdje ručno praviš DEK/KEK hijerarhiju i „brišeš“ podatke uništenjem ključa.

## Cloud data lifecycle

ISC2 i CSA (Security Guidance) koriste šest faza. Faze nisu uvijek linearne: podatak može iz Use preći u Share pa nazad u Store, a neki podaci nikad ne odu u Archive.

| Faza | Šta se dešava | Rizici | Kontrole |
|---|---|---|---|
| **Create** | podatak nastaje ili se mijenja (unos, upload, generisanje, import) | podatak bez vlasnika i klasifikacije | **klasifikacija i označavanje (labeling)** pri nastanku, vlasnik podatka, šifrovanje od prvog upisa |
| **Store** | upis u repozitorij (obično odmah nakon Create) | neovlašten pristup, pogrešna konfiguracija | šifrovanje at rest, kontrola pristupa, backup, logovanje |
| **Use** | podatak se pregleda, obrađuje, koristi (nije trajno mijenjan) | zloupotreba ovlaštenih korisnika, curenje na endpointu | IAM, DLP, aktivnosti se loguju, IRM, confidential computing |
| **Share** | podatak se čini dostupnim drugima (korisnici, partneri, javnost) | curenje van organizacije, gubitak kontrole | DLP, **IRM/DRM**, šifrovanje u prenosu, ugovori, kontrola izvoza |
| **Archive** | podatak prelazi u dugoročno skladište | gubitak ključeva ili formata kroz godine, nedostupnost za eDiscovery | šifrovanje, upravljanje ključevima dugoročno, provjera čitljivosti, retention politika |
| **Destroy** | trajno uklanjanje podatka | rezidualni podaci (data remanence), kopije u backupima | **crypto-shredding**, potvrda uništenja, retention i legal hold provjera |

Ključne poruke:

- Klasifikacija u fazi **Create** određuje kontrole u **svim** narednim fazama. Podatak koji nije klasifikovan pri nastanku vjerovatno će biti nezaštićen kasnije.
- **Use** je faza u kojoj su podaci najčešće dešifrovani, pa su tu najvažniji kontrola pristupa, logovanje i nadzor korisnika.
- **Share** je faza najvećeg rizika od gubitka kontrole: kada podatak napusti organizaciju, tehničke kontrole (IRM) i ugovori su jedina zaštita.
- **Destroy** u cloudu skoro uvijek znači **crypto-shredding**, jer customer ne može fizički uništiti medije.

> **Na ispitu:** „U kojoj fazi životnog ciklusa treba primijeniti klasifikaciju podataka?“ Odgovor je **Create**. Ako pitanje traži fazu u kojoj podatak napušta kontrolu organizacije, to je **Share**. Ako je naglasak na tome da je podatak dešifrovan i aktivno obrađen, to je **Use**.

### Uloge u vezi sa podacima

| Uloga | Odgovornost |
|---|---|
| **Data owner** | odgovoran za podatak, određuje klasifikaciju i ko smije pristupiti (poslovna uloga, ne IT) |
| **Data custodian** | sprovodi kontrole u ime vlasnika (backup, šifrovanje, pristup); često IT ili CSP |
| **Data steward** | brine o kvalitetu, metapodacima i poslovnom značenju podataka |
| **Data controller** (GDPR) | određuje svrhu i način obrade ličnih podataka |
| **Data processor** (GDPR) | obrađuje lične podatke u ime controllera (tipično CSP) |
| **Data subject** | osoba na koju se lični podaci odnose |

## Data dispersion

**Data dispersion** je raspodjela podataka na više lokacija (diskova, servera, zona dostupnosti, regiona) radi **dostupnosti i otpornosti**, a ponekad i povjerljivosti.

| Tehnika | Opis | Korist | Razmatranje |
|---|---|---|---|
| Replikacija | kompletne kopije na više lokacija | jednostavna dostupnost | više kopija = više mjesta za zaštitu i brisanje |
| **Erasure coding** | podaci se dijele na fragmente uz paritetne fragmente; original se rekonstruiše iz podskupa (npr. bilo kojih 10 od 16) | otpornost uz manje prostora od replikacije | složenije; koriste ga objektni storage servisi |
| **Bit splitting** | podaci se šifruju i dijele na dijelove koji se čuvaju kod različitih lokacija ili provajdera | nijedna lokacija nema upotrebljiv podatak | performanse, složenost upravljanja ključevima |
| Geo-distribucija | kopije u više regiona | DR i niže kašnjenje | **jurisdikcija i data residency** |

Sigurnosni aspekti disperzije:

- Disperzija povećava dostupnost i trajnost (durability), ali **otežava lociranje i brisanje svih kopija**, što je argument za crypto-shredding.
- Podaci raspoređeni u više zemalja podliježu više jurisdikcija; replikacija između regiona mora biti u skladu sa regulativom (npr. GDPR prenos van EEA).
- Bit splitting kod više provajdera može smanjiti rizik od kompromitacije jednog provajdera, ali povećava rizik dostupnosti ako je jedan dio nedostupan (zato se kombinuje sa erasure codingom).

> **Na ispitu:** kada scenario traži da podaci ostanu dostupni i nakon gubitka čitavog data centra uz efikasno korištenje prostora, misli na **erasure coding / data dispersion**. Kada traži da nijedan pojedinačni provajder ne posjeduje upotrebljiv podatak, misli na **bit splitting**.

## Data flows

**Data flow** opisuje kako se podaci kreću između komponenti, korisnika, sistema i lokacija. Bez mape tokova ne možeš znati gdje treba šifrovanje, DLP ili ugovor.

Alati i prakse:

- **Data Flow Diagram (DFD)**: prikaz izvora, procesa, skladišta i granica povjerenja (**trust boundaries**); osnova za threat modeling (STRIDE),
- **mapiranje podataka** (data mapping, records of processing po GDPR-u čl. 30): koji lični podaci, odakle, gdje se čuvaju, kome se prosljeđuju,
- **data lineage**: porijeklo i transformacije podataka kroz pipeline,
- praćenje **egress** saobraćaja i prenosa između regiona.

Šta se traži na mapi tokova:

| Element | Pitanje |
|---|---|
| Granice povjerenja | gdje podatak prelazi iz jedne zone u drugu (internet → aplikacija, aplikacija → SaaS treće strane)? |
| Prekogranični prenosi | da li podatak napušta zemlju ili EEA? Koji pravni mehanizam (SCC, adekvatnost)? |
| Šifrovanje | da li je svaki skok šifrovan (TLS, mTLS, VPN)? |
| Treće strane | koji podizvođači primaju podatke? |
| Skladišta | gdje se podaci zadržavaju, uključujući logove, keš i backupe? |

Primjer scenarija: web shop šalje narudžbe iz aplikacije u EU regionu u analitički SaaS u SAD-u. Mapa tokova otkriva prekogranični prenos ličnih podataka, pa organizacija mora imati pravni osnov (npr. EU-US Data Privacy Framework ili SCC), šifrovanje u prenosu i minimizaciju (npr. pseudonimizaciju ID-a kupca prije slanja).

## Tipovi storagea po modelima usluga

CSA i ISC2 tradicionalno vezuju tipove storagea za modele usluga:

| Model | Tipovi storagea | Opis |
|---|---|---|
| **IaaS** | **raw storage**, **volume storage**, **object storage**, **ephemeral** | raw: direktno mapiran fizički uređaj (npr. raw device mapping); volume: virtualni blok disk zakačen za VM; object: objekti preko API-ja |
| **PaaS** | **structured** (baze podataka), **unstructured** (big data, blob) | provajder upravlja engineom, customer podacima |
| **SaaS** | **information storage and management** (podaci u aplikaciji), **content and file storage** (fajlovi kroz aplikaciju) | customer pristupa samo kroz aplikaciju |

Tipovi koje outline eksplicitno navodi:

| Tip | Opis | Primjeri | Ključne karakteristike |
|---|---|---|---|
| **Long-term** | jeftino arhivsko skladište za rijetko korištene podatke | S3 Glacier, Azure Archive, GCS Archive | niska cijena, sporije vraćanje (minute do sati), često **WORM / object lock** za zakonsko čuvanje |
| **Ephemeral** | privremeno skladište vezano za život instance | instance store, lokalni SSD, emptyDir u Kubernetesu | nestaje pri gašenju; ne čuvati ništa trajno; brzo |
| **Raw storage** | direktan pristup fizičkom uređaju ili LUN-u, bez apstrakcije | raw device mapping, bare-metal diskovi | visoke performanse, zahtijeva pažljivo upravljanje i sanitizaciju |
| **Object storage** | ravan namespace objekata sa metapodacima, pristup preko HTTP API-ja | S3, Azure Blob, GCS | skoro neograničena skalabilnost, politike pristupa po bucketu i objektu, verzionisanje |
| **Volume storage** | virtualni blok uređaj zakačen za instancu, formatira se fajl sistemom | EBS, Azure Managed Disks, Persistent Disk | snapshoti, šifrovanje po volumenu, zakačen za jednu zonu |

Dodatno se pominju **file storage** (dijeljeni NFS/SMB: EFS, Azure Files) i **CDN** (keširanje sadržaja na rubu).

## Prijetnje po tipovima storagea

| Tip | Tipične prijetnje | Kontrole |
|---|---|---|
| Object storage | **javni bucketi** zbog pogrešne politike, preširoki pre-signed URL-ovi, brisanje ili ransomware šifrovanje objekata | block public access, bucket politike sa least privilegeom, verzionisanje + object lock, šifrovanje sa CMK, logovanje pristupa, Macie/DLP |
| Volume storage | **javno dijeljeni snapshoti**, nešifrovani volumeni, krađa snapshota za offline analizu, ostaci podataka | podrazumijevano šifrovanje volumena, zabrana javnih snapshota, IAM nad snapshotima, crypto-shredding |
| Ephemeral | gubitak podataka pri gašenju, tajne ostale u lokalnom disku, gubitak forenzičkih dokaza | ne čuvati trajne podatke, šifrovanje lokalnog diska, centralno logovanje |
| Raw storage | rezidualni podaci između tenanta, direktan pristup bez apstrakcijskih kontrola | sanitizacija od strane CSP-a, šifrovanje na nivou customera |
| Long-term | **gubitak ključeva** kroz godine, zastarjeli formati, neovlašten pristup arhivi, nemogućnost pronalaženja za eDiscovery | upravljanje ključevima sa dugim životnim vijekom, WORM, periodično testiranje vraćanja, indeksiranje |
| Baze (structured) | SQL injection, preširoki pristup, nešifrovani backupi, izložen endpoint | privatni endpointi, IAM autentikacija, šifrovanje, auditing, maskiranje |

Opšte prijetnje svim tipovima:

- **neovlašten pristup i curenje** (misconfiguration je glavni uzrok),
- **gubitak podataka** (brisanje, kvar, ransomware),
- **narušavanje integriteta** (neovlaštena izmjena),
- **jurisdikcija** (podaci u neodgovarajućoj zemlji),
- **data remanence** (ostaci podataka nakon brisanja),
- **denial of service** nad storage servisom ili troškom (masovno čitanje i egress).

> **Na ispitu:** za zaštitu backupa i arhiva od ransomwarea NAJBOLJI odgovor je **nepromjenjivo (immutable/WORM) skladište** uz verzionisanje i odvojene kredencijale, a ne samo češći backup: napadač sa administratorskim pravima može obrisati i backupe ako nisu zaključani.

## Šifrovanje i upravljanje ključevima

### Gdje se šifruje

| Nivo | Opis | Štiti od | Ne štiti od |
|---|---|---|---|
| **Storage-level** (volume, disk) | provajder šifruje cijeli volumen ili disk | krađe fizičkog medija, rezidualnih podataka | korisnika ili aplikacije sa pristupom volumenu |
| **Object / file-level** | šifrovanje pojedinih objekata ili fajlova (SSE ili client-side) | neovlaštenog pristupa storageu bez prava na ključ | aplikacije koja ima pravo dešifrovanja |
| **Database-level** (TDE) | baza šifruje fajlove podataka transparentno | krađe fajlova baze i backupa | SQL pristupa sa ovlaštenim nalogom |
| **Column / field-level** | šifrovanje pojedinih kolona (npr. JMBG) | administratora baze i preširokog pristupa | aplikacije sa ključem |
| **Application-level / client-side** | aplikacija šifruje prije slanja u cloud | provajdera i svih slojeva ispod | kompromitovane aplikacije |

Pravilo: **što bliže aplikaciji i podatku se šifruje, to je manje strana koje mogu vidjeti otvoreni tekst**, ali je i veća složenost (pretraga, indeksi, upravljanje ključevima).

### Envelope encryption

Cloud KMS servisi rade po principu envelope encryption:

1. aplikacija traži od KMS-a novi **Data Encryption Key (DEK)**,
2. KMS vraća DEK u otvorenom obliku i isti DEK šifrovan **Key Encryption Keyem (KEK)** koji nikad ne napušta HSM,
3. aplikacija šifruje podatke DEK-om (lokalno, brzo), čuva **šifrovani** DEK uz podatke i briše otvoreni DEK iz memorije,
4. za dešifrovanje šalje šifrovani DEK KMS-u, koji (ako IAM i key policy dozvoljavaju) vraća otvoreni DEK.

Prednosti: veliki podaci ne putuju do KMS-a, svaki objekat može imati svoj DEK, a **uništenje KEK-a čini sve DEK-ove i podatke neupotrebljivim** (crypto-shredding). Upravo to radiš u labu ovog modula.

### Posebne vrste šifrovanja

| Tehnika | Opis | Kada |
|---|---|---|
| **Format-Preserving Encryption (FPE)** | šifrat zadržava format originala (npr. 16 cifara); NIST SP 800-38G (FF1) | legacy sistemi koji očekuju određeni format polja |
| **Homomorphic encryption** | računanje nad šifrovanim podacima bez dešifrovanja | istraživanje i uske primjene; još spor za opštu upotrebu |
| **Searchable / deterministic encryption** | ista vrijednost daje isti šifrat, pa je moguća pretraga po jednakosti | šifrovane kolone koje se pretražuju; slabija zaštita od analize frekvencija |
| **Client-side encryption** | šifruje aplikacija prije upisa u cloud | kada provajder ne smije vidjeti otvoreni tekst |

### Ko drži ključ: brzi podsjetnik

Modeli provider-managed, customer-managed (CMK), BYOK i HYOK objašnjeni su u modulu 2. Za izbor važi pravilo: što su podaci osjetljiviji i stroža regulativa, to više kontrole nad ključem customer treba zadržati, uz svjesno prihvatanje veće operativne odgovornosti (gubitak ključa = gubitak podataka).

### Životni ciklus ključa i dobre prakse

| Faza | Praksa |
|---|---|
| Generisanje | u HSM-u (FIPS 140-3), kvalitetan izvor slučajnosti |
| Distribucija | nikad u otvorenom obliku; wrapping drugim ključem |
| Skladištenje | odvojeno od podataka; HSM/KMS |
| Korištenje | least privilege nad ključem (key policy), logovanje svake upotrebe |
| Rotacija | redovna (npr. godišnje) i odmah pri sumnji na kompromitaciju |
| Arhiviranje | stare verzije čuvati dok postoje podaci šifrovani njima |
| Uništavanje | planirano, uz period čekanja i dokaz; crypto-shredding |

Separation of duties: administratori ključeva ne bi trebali imati pristup podacima, a korisnici podataka ne bi smjeli brisati ili mijenjati politike ključeva.

## Tokenizacija

**Tokenizacija** zamjenjuje osjetljivu vrijednost (npr. broj kartice) **tokenom**, nasumičnom vrijednošću bez matematičke veze sa originalom. Veza original ↔ token čuva se u **token vaultu**, izolovanom i strogo zaštićenom sistemu.

| | Šifrovanje | Tokenizacija |
|---|---|---|
| Veza sa originalom | matematička (ključ + algoritam) | nema; samo mapiranje u vaultu |
| Reverzibilnost | ko ima ključ, dešifruje | samo kroz token vault |
| Format | šifrat obično mijenja format (osim FPE) | token može zadržati format (16 cifara, zadnje 4 iste) |
| Uticaj na obim usklađenosti | sistemi sa šifrovanim PAN-om i dalje mogu biti u PCI obimu | sistemi koji vide samo tokene mogu izaći iz **PCI DSS obima** |
| Tipična upotreba | podaci at rest i in transit uopšte | kartice, JMBG, brojevi računa u aplikacijama i analitici |

Arhitektura: aplikacija za plaćanje šalje broj kartice tokenizacionom servisu (često eksterni provajder plaćanja), dobija token i dalje čuva samo token. CRM, analitika i podrška rade sa tokenima.

> **Na ispitu:** „Kompanija želi da smanji broj sistema u obimu PCI DSS-a, a da aplikacije i dalje rade sa vrijednošću istog formata.“ NAJBOLJI odgovor je **tokenizacija**. Šifrovanje štiti podatke, ali sistemi koji imaju pristup ključu ostaju u obimu, a hashing nije pogodan jer brojevi kartica imaju mali prostor vrijednosti i hash se ne može koristiti za stvarno plaćanje.

## Hashing

**Hash funkcija** pretvara ulaz proizvoljne dužine u izlaz fiksne dužine (digest). Osobine: **jednosmjerna** (nije moguće vratiti ulaz), **deterministička** i **otporna na kolizije**.

| Upotreba | Kako | Napomena |
|---|---|---|
| **Integritet podataka** | uporediti hash prije i poslije prenosa ili čuvanja | SHA-256/SHA-3; MD5 i SHA-1 su zastarjeli zbog kolizija |
| Integritet sa autentikacijom | **HMAC**: hash uz tajni ključ | potvrđuje da poruku nije mijenjao neko bez ključa |
| **Nonrepudiation** | **digitalni potpis**: hash poruke šifrovan privatnim ključem pošiljaoca | samo vlasnik privatnog ključa je mogao potpisati; hash sam po sebi ne daje nonrepudiation |
| Čuvanje lozinki | sporo hashovanje sa **saltom** (Argon2, bcrypt, scrypt, PBKDF2) | salt sprječava rainbow table napade |
| Integritet logova i dokaza | hash lanac, hash dokaza u forenzici (chain of custody) | dokazuje da logovi nisu mijenjani |
| Deduplikacija i identifikacija | hash fajla kao identifikator | npr. poznati malver po hashu |

Važne razlike:

- **Hash ≠ šifrovanje**: šifrovanje je reverzibilno uz ključ, hash nije.
- **Hash ≠ nonrepudiation**: bilo ko može izračunati hash; nonrepudiation zahtijeva asimetrični potpis vezan za identitet (PKI).
- Hashovanje identifikatora sa malim prostorom vrijednosti (telefonski brojevi, kartice) bez tajnog ključa je slaba pseudonimizacija: napadač može izračunati sve hashove.

> **Na ispitu:** pitanje „kako dokazati da je ugovor poslao baš određeni partner i da nije mijenjan“ traži **digitalni potpis** (hash + privatni ključ), ne sam hash i ne HMAC (HMAC koristi dijeljeni ključ, pa obje strane mogu napraviti isti MAC i nema nonrepudiationa).

## Data Loss Prevention (DLP)

**DLP** otkriva i sprječava neovlašteno curenje osjetljivih podataka.

| Lokacija | Šta prati | Primjer |
|---|---|---|
| **Data at rest** (storage DLP) | skenira repozitorije i otkriva osjetljive podatke | Macie nad S3, Purview nad SharePointom |
| **Data in motion** (network DLP) | saobraćaj, email, web upload | email gateway blokira slanje JMBG-ova van domena |
| **Data in use** (endpoint DLP) | akcije na uređaju: kopiranje, štampa, USB | blokada kopiranja povjerljivog fajla na USB |
| Cloud/CASB DLP | aktivnosti u SaaS aplikacijama | blokada javnog dijeljenja dokumenta označenog kao povjerljiv |

Komponente DLP-a:

1. **discovery i klasifikacija** (gdje su osjetljivi podaci: regex, rječnici, fingerprinting, ML klasifikatori, labeli),
2. **monitoring** (praćenje kretanja i upotrebe),
3. **enforcement** (akcije: upozori, blokiraj, šifruj, karantin, zahtijevaj opravdanje),
4. **izvještavanje** i upravljanje incidentima.

Izazovi u cloudu: šifrovani saobraćaj (TLS inspekcija ili API integracija), mnogo SaaS aplikacija (CASB), lažno pozitivni rezultati, privatnost zaposlenih, performanse. DLP je onoliko dobar koliko i **klasifikacija** na kojoj se zasniva.

Preporučeni redoslijed uvođenja: prvo **monitoring mode** (samo bilježi i upozorava), podešavanje pravila i smanjenje lažnih pozitiva, zatim postepeno **blokiranje** za najkritičnije kategorije.

## Obfuskacija podataka

**Data obfuscation** je skupni naziv za tehnike koje skrivaju ili mijenjaju podatke tako da se smanji izloženost.

| Tehnika | Opis | Reverzibilno? | Tipična upotreba |
|---|---|---|---|
| **Static masking** | trajno mijenja podatke u kopiji (npr. test baza dobija lažna imena) | ne | razvoj i testiranje sa realističnim podacima |
| **Dynamic masking** | podaci se maskiraju u trenutku prikaza prema ulozi; original ostaje u bazi | original postoji | podrška vidi samo zadnje 4 cifre kartice |
| **Anonymization** | nepovratno uklanja vezu sa osobom (direktne i indirektne identifikatore) | ne | statistika, otvoreni podaci, istraživanje; anonimni podaci nisu lični podaci po GDPR-u |
| **Pseudonymization** | identifikatori se zamjenjuju pseudonimima; ponovna identifikacija moguća uz dodatnu informaciju koja se čuva odvojeno | da (uz ključ/tabelu) | analitika uz smanjen rizik; i dalje **lični podaci** po GDPR-u |
| Tokenizacija | vidi gore | da (kroz vault) | plaćanja |
| Šifrovanje | vidi gore | da (uz ključ) | opšta zaštita |
| Substitution / shuffling | zamjena vrijednosti realističnim ili miješanje među redovima | ne | test podaci |
| Nulling / deletion | brisanje ili zamjena sa NULL | ne | uklanjanje nepotrebnih polja |
| Generalization | smanjenje preciznosti (godina umjesto datuma rođenja, region umjesto adrese) | ne | podrška anonimizaciji (k-anonymity) |

Napomene:

- **Indirektni identifikatori** (poštanski broj + datum rođenja + pol) mogu omogućiti ponovnu identifikaciju čak i bez imena. Prava anonimizacija mora ih uzeti u obzir (k-anonymity, l-diversity, differential privacy).
- **Pseudonimizovani podaci su i dalje lični podaci** po GDPR-u, ali je pseudonimizacija prepoznata kao mjera zaštite.
- Za razvoj i testiranje NAJBOLJI izbor je obično **static masking** ili sintetički podaci, a ne kopija produkcije.

> **Na ispitu:** „Istraživački tim treba podatke pacijenata za statističku analizu i ne smije ih ni pod kojim uslovima povezati sa konkretnim osobama.“ Odgovor je **anonimizacija**. Ako tim mora povremeno ponovo identifikovati pacijenta (npr. radi kontakta u studiji), odgovor je **pseudonimizacija**. Ako podrška treba vidjeti samo dio podatka u aplikaciji, odgovor je **dynamic masking**.

## Upravljanje ključevima, tajnama i certifikatima

| Objekat | Primjeri | Alat u cloudu | Ključne prakse |
|---|---|---|---|
| **Kriptografski ključevi** | KEK, DEK, ključevi za potpis | KMS, Cloud HSM, Key Vault | HSM zaštita, key policy, rotacija, SoD, logovanje upotrebe |
| **Tajne (secrets)** | lozinke baza, API ključevi, tokeni | Secrets Manager, Key Vault, Secret Manager, HashiCorp Vault | nikad u kodu ili imageu, automatska rotacija, dinamičke kratkotrajne tajne, pristup po ulozi |
| **Certifikati** | TLS certifikati, klijentski certifikati, code signing | Certificate Manager, privatni CA | inventar, automatska obnova (ACME), praćenje isteka, zaštita privatnih ključeva |

### Tajne

Najčešća greška je tajna u izvornom kodu, konfiguracionom fajlu, environment varijabli u IaC-u ili container imageu. Dobra praksa:

- aplikacija dobija tajnu u runtimeu iz secrets managera, uz identitet workloada (rola),
- **automatska rotacija** (npr. lozinka baze svakih 30 dana bez prekida usluge),
- **dinamičke tajne**: kredencijali generisani po zahtjevu sa kratkim TTL-om,
- skeniranje repozitorija i pipelinea za slučajno izložene tajne,
- revizija pristupa tajnama kroz logove.

### Certifikati i PKI

Životni ciklus certifikata: **zahtjev (CSR) → validacija → izdavanje → instalacija → praćenje → obnova → opoziv (CRL, OCSP)**. Rizici: istekli certifikati (prekid usluge), ukradeni privatni ključevi, neovlašteno izdati certifikati.

CA/Browser Forum je 2025. usvojio postepeno skraćivanje maksimalnog trajanja javnih TLS certifikata: 200 dana od marta 2026, 100 dana od marta 2027 i **47 dana od marta 2029**. Posljedica: ručno upravljanje certifikatima postaje neodrživo, pa je **automatizacija** (ACME, managed certifikati provajdera) obavezna praksa.

Privatni CA u cloudu (npr. AWS Private CA, Google CAS) koristi se za interne servise i mTLS; korijenski CA ključ čuva se u HSM-u, a korijen se drži offline ili strogo ograničen.

> **Na ispitu:** kada se pita NAJBOLJI način da aplikacija koristi lozinku baze, odgovor je **secrets manager uz identitet workloada i automatsku rotaciju**. Šifrovana lozinka u konfiguracionom fajlu i dalje traži ključ negdje u aplikaciji („problem kornjače na kornjači“).

## Izbor tehnike: vodič za scenarije

| Zahtjev u scenariju | NAJBOLJA tehnika |
|---|---|
| smanjiti PCI DSS obim, zadržati format | tokenizacija |
| zaštititi podatke od provajdera | client-side šifrovanje sa ključem customera (HYOK) |
| dokazati da fajl nije mijenjan | hash (SHA-256) |
| dokazati ko je poslao poruku | digitalni potpis |
| podrška vidi samo zadnje 4 cifre | dynamic masking |
| test okruženje sa realističnim, ali lažnim podacima | static masking / sintetički podaci |
| statistika bez mogućnosti identifikacije | anonimizacija |
| analitika sa mogućnošću ponovne identifikacije | pseudonimizacija |
| spriječiti slanje JMBG-ova emailom van firme | DLP (data in motion) |
| pronaći osjetljive podatke u bucketima | DLP discovery (data at rest) |
| „obrisati“ podatke u cloudu | crypto-shredding |
| lozinka baze za aplikaciju | secrets manager + rola + rotacija |

## Primjer scenarija: platforma za telemedicinu

Startup razvija platformu za video konsultacije sa ljekarima. Podaci: zdravstveni kartoni, snimci, kartice za plaćanje.

1. **Lifecycle**: kartoni se klasifikuju kao „zdravstveni – strogo povjerljivo“ pri kreiranju (Create); čuvaju se šifrovani CMK-om (Store); ljekari ih vide kroz aplikaciju uz logovanje (Use); dijele se sa laboratorijom preko IRM-a (Share); arhiviraju se 10 godina po zakonu uz WORM (Archive); po isteku se uništavaju crypto-shreddingom (Destroy).
2. **Storage**: snimci u object storageu sa block public access, verzionisanjem i object lockom; baze u PaaS-u sa privatnim endpointom.
3. **Dispersion i flows**: replikacija samo unutar EU regiona; DFD otkriva da analitički alat šalje događaje u SAD, pa se prije slanja uklanjaju identifikatori.
4. **Tehnike**: tokenizacija kartica kod procesora plaćanja; dynamic masking za podršku; pseudonimizacija za analitiku; DLP na emailu i u SaaS kolaboraciji.
5. **Ključevi i tajne**: KEK u HSM-u, DEK po pacijentu (omogućava brisanje podataka jednog pacijenta uništenjem njegovog DEK-a), tajne u secrets manageru sa rotacijom, automatski TLS certifikati.

## Česte zamke

| Distraktor | Zašto je pogrešan |
|---|---|
| „Hash daje nonrepudiation.“ | treba digitalni potpis (asimetrični ključ vezan za identitet) |
| „Pseudonimizovani podaci nisu lični podaci.“ | po GDPR-u jesu; samo anonimni nisu |
| „Tokenizacija je vrsta šifrovanja.“ | token nema matematičku vezu sa originalom |
| „Šifrovanje volumena štiti od administratora aplikacije.“ | štiti od krađe medija, ne od ovlaštenog pristupa |
| „DLP se uvodi odmah u režimu blokiranja.“ | prvo monitoring i podešavanje |
| „Klasifikacija se radi pri arhiviranju.“ | radi se pri kreiranju (Create) |
| „Ephemeral storage je dobar za logove aplikacije.“ | nestaje sa instancom; logovi moraju ići centralno |

## Rezime

- Lifecycle: **Create → Store → Use → Share → Archive → Destroy**; klasifikacija u Create, najveći rizik gubitka kontrole u Share, Destroy u cloudu = crypto-shredding.
- Uloge: **owner, custodian, steward**; po GDPR-u **controller, processor, subject**.
- **Data dispersion**: replikacija, **erasure coding**, **bit splitting**; povećava dostupnost, ali komplikuje jurisdikciju i brisanje.
- **Data flows**: DFD, granice povjerenja, prekogranični prenosi, mapiranje i lineage.
- Storage: **long-term** (arhiva, WORM), **ephemeral** (nestaje), **raw**, **object** (API, bucketi), **volume** (blok, snapshoti); po modelima IaaS/PaaS/SaaS.
- Prijetnje: javni bucketi i snapshoti, ransomware, gubitak ključeva u arhivi, data remanence, jurisdikcija.
- Šifrovanje: što bliže podatku, to manje ko vidi otvoreni tekst; **envelope encryption** (DEK/KEK); životni ciklus ključa i SoD.
- **Tokenizacija** (vault, smanjuje PCI obim) ≠ šifrovanje; **hash** za integritet, **potpis** za nonrepudiation, **salt** za lozinke.
- **DLP**: at rest, in motion, in use; discovery, monitoring, enforcement; počni u monitoring modu.
- Obfuskacija: **static/dynamic masking**, **anonymization** (nepovratno), **pseudonymization** (i dalje lični podaci), generalizacija.
- Ključevi, tajne i certifikati: KMS/HSM, secrets manager sa rotacijom i identitetom workloada, **automatizovano upravljanje certifikatima** (put ka 47-dnevnim TLS certifikatima).
