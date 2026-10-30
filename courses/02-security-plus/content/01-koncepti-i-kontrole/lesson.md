## Ciljevi ispita: 1.1 i 1.2

- **1.1** Explain security concepts and controls: osnovni koncepti (CIA, AAA, non-repudiation, Zero Trust, least privilege, defense in depth) i klasifikacija kontrola po **kategoriji** i **tipu**.
- **1.2** Given a scenario, demonstrate the impact of change management processes on security: kako proces promjena (CAB, backout plan, maintenance window…) i tehnički detalji promjene (restart, zavisnosti, allow liste…) utiču na sigurnost.

Ispit ovdje rijetko pita čistu definiciju. Najčešće dobiješ kratak scenarij („kompanija postavi znak…", „promjena je pala usred noći…") i treba da prepoznaš pojam.

## Defense in depth

**Defense in depth** (odbrana u dubini, slojevita odbrana) znači da se ne oslanjaš na jednu kontrolu. Ako jedan sloj padne, sljedeći zaustavlja ili bar otkriva napad.

Primjer iz cloud svijeta za jednu web aplikaciju:

| Sloj | Primjer kontrole |
|---|---|
| Perimetar | AWS WAF / Azure Front Door WAF, DDoS zaštita |
| Mreža | Security Groups, NSG, Kubernetes NetworkPolicy |
| Host / kontejner | Hardening slike, read-only root FS, bez root korisnika |
| Aplikacija | Validacija ulaza, autentifikacija, rate limiting |
| Podaci | Enkripcija at rest (KMS), backup, maskiranje |
| Ljudi i procesi | Obuka, code review, change management |
| Detekcija | CloudTrail, Azure Monitor, SIEM alarmi |

Svi pojmovi ispod (CIA, AAA, Zero Trust, least privilege) su dijelovi te slojevite slike.

## CIA trijada

| Pojam | Značenje | Šta ga ugrožava | Tipične kontrole |
|---|---|---|---|
| **Confidentiality** (povjerljivost) | Samo ovlašteni vide podatke | Curenje, sniffing, javni S3 bucket | Enkripcija, kontrola pristupa, maskiranje |
| **Integrity** (integritet) | Podaci nisu neovlašteno izmijenjeni | Manipulacija, MITM, greška u prenosu | Hashing, digitalni potpisi, verzionisanje |
| **Availability** (dostupnost) | Sistem i podaci dostupni kad trebaju | DDoS, ransomware, kvar hardvera | Redundansa, auto-scaling, backup, multi-AZ |

> **Na ispitu:** Hash i digitalni potpis su odgovor za **integrity**. Enkripcija je odgovor za **confidentiality**. Redundansa, load balancer i backup su **availability**. Ako pitanje kaže „osigurati da podaci nisu promijenjeni", traži hash, ne enkripciju.

## AAA

**AAA** opisuje tri koraka kontrole pristupa. Ispred njih stoji **identifikacija** (tvrdiš ko si, npr. korisničko ime).

| Korak | Engleski | Pitanje | Primjer |
|---|---|---|---|
| Autentifikacija | **Authentication** | Dokaži da si to ti | Lozinka + MFA, klijentski certifikat, SSH ključ |
| Autorizacija | **Authorization** | Šta smiješ raditi? | IAM policy, Kubernetes RBAC, Azure RBAC uloga |
| Evidencija | **Accounting** | Šta si uradio i kada? | CloudTrail, Azure Activity Log, kube-apiserver audit log |

AAA se ne odnosi samo na ljude. Ispit razlikuje:

- **Autentifikacija ljudi**: lozinke, MFA, biometrija.
- **Autentifikacija sistema i uređaja**: certifikati (mTLS), 802.1X za uređaje na mreži, workload identity (npr. IRSA u EKS-u ili Azure Managed Identity).
- **Autorizacioni modeli** određuju ko dobija koja prava (detalji su u kasnijem modulu o IAM-u).

RADIUS i TACACS+ su klasični **AAA serveri** za mrežnu opremu i VPN. TACACS+ odvaja sva tri A i šifruje cijeli paket, RADIUS šifruje samo lozinku.

> **Na ispitu:** „Kako znamo ko je obrisao resurs?" je **accounting**. „Korisnik se prijavio ali ne vidi bazu" je problem **authorization**, ne authentication.

## Non-repudiation

**Non-repudiation** (neporecivost) znači da pošiljalac ne može kasnije uvjerljivo poreći da je poslao poruku ili izvršio akciju.

- Postiže se **digitalnim potpisom**: potpisuješ privatnim ključem koji imaš samo ti, svako provjerava javnim ključem.
- Potpis istovremeno daje **integritet** (poruka nije mijenjana) i **autentičnost porijekla**.
- Simetrični ključ (npr. HMAC sa dijeljenom tajnom) **ne daje** neporecivost: obje strane imaju isti ključ, pa je svaka mogla napraviti poruku.
- Audit logovi pomažu, ali su jači ako su zaštićeni od izmjene (WORM storage, centralni SIEM).

Primjer: potpisani git commitovi (GPG/SSH potpis) ili potpisane container slike (Sigstore cosign) dokazuju ko je napravio artefakt.

## Zero Trust principi

**Zero Trust** odbacuje ideju „unutar mreže = povjerljivo". Svaki zahtjev se provjerava, bez obzira odakle dolazi.

Ključni principi:

- **Never trust, always verify**: svaka sesija se autentifikuje i autorizuje.
- **Least privilege** i pristup **just-in-time**.
- **Assume breach**: dizajniraj kao da je napadač već unutra; segmentiraj.
- **Kontinuirana procjena**: identitet, stanje uređaja (device posture), lokacija, rizik.

Arhitektura se dijeli na dvije ravni:

| Ravan | Engleski | Komponente | Uloga |
|---|---|---|---|
| Kontrolna | **Control plane** | **Policy Engine**, **Policy Administrator**, adaptive identity, threat scope reduction, policy-driven access control | Odlučuje da li je pristup dozvoljen |
| Podatkovna | **Data plane** | **Policy Enforcement Point (PEP)**, subjekt/sistem, implicitne zone povjerenja | Sprovodi odluku i propušta saobraćaj |

- **Policy Engine** donosi odluku (dozvoli/odbij) na osnovu politika i signala.
- **Policy Administrator** izvršava odluku: uspostavi ili prekine sesiju, izda token.
- **PEP** je tačka kroz koju saobraćaj prolazi (proxy, gateway, agent).

DevOps primjeri: AWS Verified Access, Azure AD Conditional Access, service mesh sa mTLS i autorizacionim politikama (Istio `AuthorizationPolicy`).

> **Na ispitu:** Ako pitanje opisuje komponentu koja **odlučuje**, to je Policy Engine. Ako opisuje komponentu kroz koju saobraćaj **prolazi** i koja propušta ili blokira, to je Policy Enforcement Point.

## Least privilege

**Least privilege** (najmanje privilegije): korisnik, servis ili proces dobija samo prava neophodna za posao, i samo dok mu trebaju.

- IAM policy sa konkretnim akcijama i resursima umjesto `"Action": "*"`.
- Kubernetes ServiceAccount sa minimalnom Role, bez `cluster-admin`.
- Odvojeni admin nalozi i privilegovani pristup po potrebi (PAM, Azure PIM).
- Periodični pregled prava (access review) da se ukloni **privilege creep** (nagomilavanje prava pri promjeni uloge).

Srodni pojmovi: **separation of duties** (jedna osoba ne može sama završiti osjetljiv proces) i **need to know**.

## Kategorije kontrola

Kategorija odgovara na pitanje **KAKO** je kontrola sprovedena.

| Kategorija | Engleski | Opis | Primjeri |
|---|---|---|---|
| Tehnička | **Technical / logical** | Sprovodi je sistem, softver ili hardver | Firewall, enkripcija, MFA, antivirus, IAM politika |
| Upravljačka | **Managerial / administrative** | Odluke, politike i upravljanje rizikom | Sigurnosna politika, procjena rizika, klasifikacija podataka |
| Operativna | **Operational** | Sprovode je ljudi u svakodnevnom radu | Obuka zaposlenih, čuvar na ulazu, procedura za backup, pregled logova |
| Fizička | **Physical / environmental** | Ograničava fizički pristup ili štiti okruženje | Brava, ograda, kamera, gašenje požara, klima u server sali |

Razlika managerial vs operational često zbunjuje:

- **Managerial** = planiranje i nadzor (politika kaže „svi moraju proći obuku").
- **Operational** = izvršavanje od strane ljudi (sama obuka, čuvar, administrator koji ručno pregleda logove).

## Tipovi kontrola

Tip odgovara na pitanje **ŠTA** kontrola radi, odnosno kada djeluje u odnosu na incident.

| Tip | Engleski | Šta radi | Primjeri |
|---|---|---|---|
| Preventivna | **Preventive** | Sprečava da se incident desi | Firewall pravilo, MFA, zaključana vrata, least privilege |
| Odvraćajuća | **Deterrent** (u ciljevima „Deterring") | Obeshrabruje napadača, ali ga fizički ne sprečava | Znak „Video nadzor", upozoravajući login banner, svjetla |
| Detektivna | **Detective** | Otkriva i bilježi incident dok traje ili poslije | IDS, SIEM alarm, kamera koja snima, audit log |
| Korektivna | **Corrective** | Ispravlja štetu i vraća normalno stanje | Restore iz backupa, automatsko re-deploy čistog poda, patch nakon incidenta |
| Kompenzaciona | **Compensating** | Zamjena kad primarna kontrola nije moguća | Izolovan VLAN za legacy server koji se ne može patchovati |
| Usmjeravajuća | **Directive** | Govori ljudima šta da rade | Politika, standard, SOP, znak „Samo za osoblje" |

Ista kontrola može imati više tipova. Kamera je **detective** (snima), a vidljiva kamera i **deterrent**. Kontrola uvijek ima i **kategoriju** i **tip**: firewall je *technical + preventive*, obuka je *operational + directive*, znak „video nadzor" je *physical + deterrent*.

> **Na ispitu:** Ključna riječ za **compensating** je da primarna kontrola **ne može** biti primijenjena (cijena, legacy, tehničko ograničenje) pa se uvodi nešto drugo što pokriva isti rizik. Ključna riječ za **corrective** je „nakon incidenta, vraćanje u ispravno stanje".

> **Na ispitu:** **Deterrent** vs **preventive**: preventivna kontrola stvarno blokira (brava). Odvraćajuća samo smanjuje motivaciju (znak, vidljiva kamera). Ako napadač i dalje *može* proći, a kontrola ga samo plaši, to je deterrent.

### Primjeri po kombinaciji

| Kontrola | Kategorija | Tip |
|---|---|---|
| Security Group koja dozvoljava samo port 443 | Technical | Preventive |
| GuardDuty / Defender for Cloud alarm | Technical | Detective |
| Lambda koja automatski zatvori javni S3 bucket | Technical | Corrective |
| Login banner „Neovlašten pristup je zabranjen" | Technical | Deterrent |
| Politika prihvatljive upotrebe (AUP) | Managerial | Directive |
| Godišnja procjena rizika | Managerial | Detective (otkriva rizike) |
| Čuvar na ulazu | Operational | Preventive / deterrent |
| Ograda oko data centra | Physical | Preventive / deterrent |
| Mrežna segmentacija oko nepatchovanog OT uređaja | Technical | Compensating |

## Change management

**Change management** je formalan proces kojim se promjene u sistemima predlažu, procjenjuju, odobravaju, testiraju, primjenjuju i dokumentuju. Za sigurnost je važan jer su **nekontrolisane promjene** čest uzrok incidenata: otvoren port „privremeno", isključen logging, zaboravljen test nalog.

### Poslovni procesi

| Pojam | Engleski | Opis |
|---|---|---|
| Odbor za promjene | **Change Advisory Board (CAB)** | Grupa koja pregleda i odobrava promjene. Uključuje IT, sigurnost, vlasnike sistema, biznis. |
| Proces odobrenja | **Approval process** | Formalni koraci: zahtjev, procjena, odobrenje ili odbijanje. Hitne promjene imaju ubrzani put, ali se ipak dokumentuju. |
| Vlasništvo | **Ownership** | Svaka promjena ima vlasnika koji je odgovoran za izvođenje i rezultat. |
| Zainteresovane strane | **Stakeholders** | Svi na koje promjena utiče: korisnici, tim podrške, biznis, sigurnost. Moraju biti obaviješteni. |
| Analiza uticaja | **Impact analysis** | Šta može poći po zlu, koji sistemi i korisnici su pogođeni, koji je sigurnosni rizik. |
| Rezultati testiranja | **Test results** | Dokaz da je promjena isprobana u staging/test okruženju prije produkcije. |
| Plan povlačenja | **Backout planning** | Unaprijed definisan način da se promjena poništi (rollback) ako ne uspije. |
| Popravka unaprijed | **Fail forward** | Umjesto vraćanja na staro, problem se rješava novom brzom ispravkom. |
| Prozor za održavanje | **Maintenance window** | Unaprijed dogovoren period sa najmanjim uticajem na korisnike. |
| Standardne procedure | **Standard operating procedures (SOPs)** | Dokumentovani koraci za rutinske zadatke. Ponovljivo, manje grešaka. |

Kako to izgleda u DevOps svijetu:

- Pull request sa obaveznim review-om je mini **approval process**.
- CODEOWNERS fajl definiše **ownership**.
- CI pipeline sa testovima i security skenovima daje **test results**.
- `helm rollback`, `kubectl rollout undo` ili blue/green prebacivanje nazad su **backout plan**.
- Hotfix koji se odmah pushuje kroz pipeline je **fail forward**.
- Runbook u wiki-ju je **SOP**.

> **Na ispitu:** **Backout plan** se pravi **prije** promjene. Ako pitanje pita šta treba imati spremno u slučaju da promjena ne uspije, odgovor je backout plan, ne „incident response plan". **Fail forward** je odluka da se ne vraća nazad nego ide dalje sa ispravkom, obično kad rollback nije moguć ili je rizičniji (npr. migracija baze koja je već promijenila šemu).

### Tehničke implikacije

| Pojam | Engleski | Na šta paziti |
|---|---|---|
| Liste dozvola/zabrana | **Allow lists / deny lists** | Nova aplikacija ili verzija može biti blokirana postojećom allow listom (application allow list, firewall, egress pravila). Ažuriraj ih kao dio promjene. |
| Ograničene aktivnosti | **Restricted activities** | Promjena treba raditi samo ono što je odobreno. Dodatne „usput" izmjene nisu dozvoljene. |
| Zastoj | **Downtime** | Planiraj ga i najavi. Neplanirani zastoj je udar na availability. |
| Restart servisa | **Service restart** | Restart može prekinuti sesije, izgubiti stanje u memoriji, ili otkriti da servis ne starta. |
| Restart aplikacije | **Application restart** | Aplikacija može izgubiti konfiguraciju koja nije sačuvana, ili se vratiti na default postavke. |
| Naslijeđene aplikacije | **Legacy applications** | Stari sistemi često ne podržavaju nove protokole (npr. TLS 1.2+) i nemaju dokumentaciju. Veći rizik od loma. |
| Zavisnosti | **Dependencies** | Promjena jednog servisa može srušiti drugi (biblioteka, API verzija, DNS zapis, certifikat). Mapiraj ih u analizi uticaja. |

### Dokumentacija i verzionisanje

- **Updating diagrams**: mrežni i arhitekturni dijagrami moraju pratiti stvarno stanje. Zastario dijagram vodi do pogrešnih odluka i sporijeg odgovora na incident.
- **Updating policies/procedures**: ako promjena mijenja način rada, ažuriraj politike, SOP-ove i runbookove.
- **Version control**: sve konfiguracije, IaC (Terraform, Bicep), Helm chartovi i politike u git-u. Daje istoriju ko je šta promijenio, mogućnost poređenja i vraćanja. To je i dokaz za audit.

> **Na ispitu:** Ako je scenarij „nakon promjene niko ne zna kako mreža sada izgleda" ili „tim za incidente je koristio zastarjelu mapu", odgovor je **updating diagrams / documentation**. Ako je problem „ne znamo koja verzija konfiguracije je radila", odgovor je **version control**.

### Tipičan tok promjene

1. Zahtjev za promjenu (RFC) sa opisom i vlasnikom.
2. **Impact analysis** i procjena rizika.
3. Testiranje u ne-produkcionom okruženju, prilaganje **test results**.
4. Priprema **backout plana**.
5. **CAB approval**.
6. Izvođenje u **maintenance window**, uz obavještenje stakeholdera.
7. Verifikacija nakon promjene.
8. Ažuriranje dokumentacije, dijagrama i verzija.

## Primjer: promjena kroz cijeli proces

Scenarij: tim mora zamijeniti TLS certifikat i isključiti TLS 1.0/1.1 na javnom API gatewayu.

| Korak | Šta se radi | Sigurnosni razlog |
|---|---|---|
| Zahtjev i **ownership** | Otvara se change request, vlasnik je platform tim | Jasna odgovornost |
| **Impact analysis** | Provjera ko još koristi TLS 1.0 (stari mobilni klijenti, partnerski legacy sistem). Mapiranje **dependencies**: DNS, certifikat na CDN-u, health checkovi | Isključivanje starih verzija može prekinuti **legacy applications** |
| **Test results** | Promjena isprobana u stagingu, testovi klijenata i skener TLS konfiguracije | Dokaz da promjena radi |
| **Backout plan** | Stari listener i certifikat ostaju sačuvani, rollback je jedna komanda u pipelineu | Brz povratak ako nešto pukne |
| **CAB approval** | CAB odobrava uz uslov da partner bude unaprijed obaviješten | Uključeni **stakeholders** |
| **Maintenance window** | Utorak 02:00–03:00 | Najmanji uticaj na korisnike |
| Izvođenje | Samo odobrene izmjene (**restricted activities**), praćenje grešaka nakon **service restart**-a gatewaya | Bez neplaniranog **downtime**-a |
| Dokumentacija | Ažuriran dijagram, SOP za rotaciju certifikata, commit u git | **Version control** i **updated diagrams/procedures** |

Ako nakon promjene partner prijavi problem, tim bira između **backout** (vrati TLS 1.0 privremeno uz kompenzacionu kontrolu) i **fail forward** (pomozi partneru da odmah pređe na TLS 1.2). Odluka se dokumentuje.

## Kako klasifikovati kontrolu u dva koraka

1. **Ko ili šta je sprovodi?** Sistem → *technical*. Dokument ili odluka uprave → *managerial*. Čovjek u svakodnevnom radu → *operational*. Fizički objekat ili okruženje → *physical*.
2. **Kada i kako djeluje?** Prije incidenta i blokira → *preventive*. Prije i samo plaši → *deterrent*. Tokom ili poslije, otkriva → *detective*. Poslije, popravlja → *corrective*. Umjesto nemoguće primarne kontrole → *compensating*. Govori šta treba raditi → *directive*.

Primjer: „Kubernetes admission controller (Kyverno) odbija pod koji traži `privileged: true`" → sprovodi sistem (*technical*), blokira prije nego što se desi (*preventive*). „Politika da svi podovi moraju imati resource limite" → dokument (*managerial*), govori šta treba (*directive*).

## Rezime

- **Defense in depth**: više slojeva kontrola, nijedan sloj nije dovoljan sam.
- **CIA**: enkripcija = confidentiality, hash/potpis = integrity, redundansa/backup = availability.
- **AAA**: authentication (ko si), authorization (šta smiješ), accounting (šta si uradio). **Non-repudiation** dolazi od digitalnog potpisa.
- **Zero Trust**: never trust, always verify. Policy Engine odlučuje, PEP sprovodi.
- Kontrola ima **kategoriju** (technical, managerial, operational, physical) i **tip** (preventive, deterrent, detective, corrective, compensating, directive).
- **Compensating** = zamjena kad primarna kontrola nije izvodljiva. **Deterrent** samo obeshrabruje.
- Change management: **CAB**, **impact analysis**, **test results**, **backout plan** prije promjene, **maintenance window**, **SOP**.
- Tehničke posljedice promjene: restarti, downtime, zavisnosti, legacy, allow liste. Uvijek ažuriraj dijagrame, politike i **version control**.
