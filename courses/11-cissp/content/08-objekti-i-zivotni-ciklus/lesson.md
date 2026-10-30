## Ciljevi ispita: 3.8, 3.9 i 3.10

Ovaj modul zatvara domen 3: fizička sigurnost lokacije i objekata i upravljanje životnim ciklusom informacionog sistema. Fizička sigurnost se ponovo javlja u domenu 7 (7.14, 7.15), ali tamo iz ugla operacija; ovdje je fokus na **dizajnu**.

- **3.8 Apply security principles to site and facility design.**
- **3.9 Design site and facility security controls**
  - wiring closets / intermediate distribution frame (IDF),
  - server rooms / data centers,
  - media storage facilities, evidence storage,
  - restricted and work area security,
  - utilities i HVAC,
  - environmental issues (prirodne katastrofe, ljudski faktor),
  - fire prevention, detection, and suppression,
  - power (redundant, backup).
- **3.10 Manage the information system lifecycle**
  - stakeholder needs and requirements, requirements analysis,
  - secure architectural design, development/implementation, integration,
  - verification and validation, transition/deployment,
  - operations and maintenance/sustainment, retirement/secure disposal,
  - continuous security review.

> U outlineu iz 2024. 3.9 je govorio o „intermediate distribution **facilities**“ umjesto „frame“, a 3.10 je imao „Architectural design“ i „Retirement/disposal“ bez riječi „secure“ i nije imao „Continuous security review“. Sadržajno, novi outline naglašava da se sigurnost provjerava kontinuirano kroz cijeli životni ciklus.

Ključni način razmišljanja: **ljudski život i bezbjednost su uvijek na prvom mjestu**. Nijedna fizička kontrola ne smije ugroziti evakuaciju, a sistem gašenja požara se bira tako da ne ugrozi ljude.

## Principi dizajna lokacije i objekta (3.8)

### Strategija slojeva

Fizička sigurnost slijedi defense in depth od spoljne granice ka centru: **perimetar lokacije → zgrada → sprat/zona → prostorija → rack → uređaj**. Kontrole imaju funkcije koje se nadovezuju:

| Funkcija | Cilj | Primjeri |
|---|---|---|
| **Deter** (odvratiti) | da napadač odustane | ograde, rasvjeta, znakovi, vidljive kamere, čuvari |
| **Deny** (onemogućiti) | da ne može ući | brave, zidovi, bollards, mantrap |
| **Detect** (otkriti) | da se pokušaj primijeti | senzori pokreta, alarmi na vratima, CCTV sa analitikom |
| **Delay** (usporiti) | da se dobije vrijeme za reakciju | ojačana vrata, višestruke barijere, sefovi |
| **Respond** (reagovati) | zaustaviti napad | čuvari, policija, procedura |
| **Recover** (oporaviti) | povratak u normalno stanje | DR lokacija, osiguranje |

Dizajn mora obezbijediti da je vrijeme kašnjenja (delay) veće od vremena potrebnog za otkrivanje i reakciju.

### CPTED

**Crime Prevention Through Environmental Design (CPTED)** koristi samo okruženje za smanjenje kriminala:

| Princip | Značenje | Primjer |
|---|---|---|
| **Natural surveillance** | maksimalna vidljivost, ljudi vide šta se dešava | prozori prema parkingu, niske žive ograde, dobra rasvjeta |
| **Natural access control** | usmjeravanje kretanja kroz dizajn | jedan jasan ulaz, staze, žardinjere umjesto ograda |
| **Territorial reinforcement** | jasna granica privatnog prostora, osjećaj vlasništva | različita podloga, znakovi, ograde, uređen prostor |
| **Maintenance** | održavan prostor odvraća (teorija razbijenih prozora) | popravljena rasvjeta, uklanjanje grafita |

### Izbor lokacije (site selection)

- **Rizici okruženja**: plavna područja, seizmičke zone, uragani, šumski požari, blizina aerodroma, hemijskih postrojenja, autoputeva sa opasnim teretom.
- **Vidljivost**: data centar treba biti **neupadljiv** (bez natpisa koji otkrivaju namjenu).
- **Pristupačnost** za hitne službe, blizina vatrogasaca i policije.
- **Infrastruktura**: više nezavisnih izvora napajanja (različite trafostanice), više telekom provajdera sa različitim trasama, voda za hlađenje.
- **Susjedi i dijeljeni prostor**: zajednička zgrada znači dijeljenu ventilaciju, pristup i rizike.
- **Udaljenost od primarne lokacije** za DR lokaciju (da ista katastrofa ne pogodi obje).

### Dizajn zgrade

- Kritične prostorije u **centru zgrade**, ne na spoljnim zidovima, ne u podrumu (poplava) i ne na posljednjem spratu (krov, curenje).
- **Bez prozora** u server sobama; zidovi od poda do **konstrukcijske ploče** (true floor to true ceiling), ne samo do spuštenog plafona, jer se inače može ući preko plafona.
- Jedan kontrolisan ulaz uz evakuacione izlaze koji se otvaraju samo iznutra (sa alarmom).
- Zidovi i vrata sa propisanom **otpornošću na požar** (fire rating, npr. 1 sat).
- Odvajanje zona po osjetljivosti: javna zona (prijem), zona zaposlenih, ograničene zone.

> **Na ispitu:** Kada se bira mjesto za server sobu u postojećoj zgradi, NAJBOLJI izbor je **centralna lokacija na srednjem spratu**, bez prozora i spoljnih zidova, daleko od vodovodnih instalacija. Podrum (poplava) i najviši sprat (krov) su loši izbori.

## Fizičke kontrole po vrstama prostora (3.9)

### Wiring closets i IDF

**MDF (main distribution frame)** je centralna tačka telekomunikacione opreme zgrade (spoj sa provajderom), a **IDF (intermediate distribution frame)** su razvodni ormari po spratovima.

- zaključani, sa evidencijom pristupa (bedž, logovi), ne dijeliti sa spremištem čistačice,
- rackovi sa bravom, kamere na ulazu,
- napajanje i hlađenje odgovarajuće opremi (mali UPS),
- zaštita od pristupa kablovima: kablovi u kanalicama, zaštićeni patch paneli, neiskorišteni portovi isključeni (port security, NAC),
- zaštita od prisluškivanja: optika gdje je osjetljivo, kontrola fizičkog pristupa trasama,
- prostor ne smije biti ispod vodovodnih cijevi ili pored sanitarnih čvorova.

### Server sobe i data centri

| Kontrola | Detalj |
|---|---|
| Pristup | višefaktorski (bedž + PIN ili biometrija), **mantrap/airlock** za sprečavanje tailgatinga, evidencija posjetilaca sa pratnjom |
| Zone unutar DC-a | kavezi (cages) po korisniku, zaključani rackovi |
| Raspored | **hot aisle / cold aisle** raspored rackova, containment |
| Podovi | podignuti pod (raised floor) za kablove i hlađenje, uz detekciju vode ispod |
| Nadzor | CCTV, senzori temperature, vlage i vode, detekcija dima (VESDA) |
| Napajanje | dvostruki izvori (A/B feed), UPS, generator, PDU sa monitoringom |
| Tier klasifikacija (Uptime Institute) | Tier I (osnovni, 99,671%), Tier II (redundantne komponente, 99,741%), Tier III (concurrently maintainable, 99,982%), Tier IV (fault tolerant, 99,995%) |

### Media storage facilities

- kontrolisan pristup i evidencija izdavanja medija (check-in/check-out),
- **klimatski uslovi** prema proizvođaču (trake su osjetljive na temperaturu, vlagu i magnetna polja),
- vatrootporni sefovi (media-rated: papir izdrži više temperature od magnetnih medija),
- off-site skladište na dovoljnoj udaljenosti, pouzdani transport sa chain of custody,
- šifrovanje medija, inventar i periodična provjera čitljivosti,
- zaštita od data remanence: mediji za uništenje se čuvaju odvojeno do sanitizacije.

### Evidence storage

Prostor za čuvanje dokaza mora očuvati **integritet i chain of custody**:

- zasebna, zaključana prostorija ili sef sa **strogo ograničenim pristupom** (samo ovlašteni čuvar dokaza),
- **evidencija svakog ulaska i svakog preuzimanja** (ko, kada, zašto), potpisi,
- CCTV i alarmi, dvostruka brava,
- zapečaćene vrećice i ambalaža sa oznakama, tamper-evident pečati,
- uslovi okruženja koji ne oštećuju dokaze (antistatička ambalaža za elektroniku, Faradejeve vrećice za mobilne uređaje),
- odvojenost od ostalog skladišta da se izbjegne kontaminacija ili zamjena.

### Restricted i work area security

| Kontrola | Napomena |
|---|---|
| **Bedževi i kartice** (proximity, smart card) | pravilo da se bedž nosi vidljivo; brzo ukidanje pri odlasku |
| **Mantrap / access control vestibule** | dvoja vrata, jedna se otvaraju tek kad se druga zatvore; sprečava **piggybacking/tailgating** |
| **Turnstiles** | jedna osoba po prolazu |
| **Brave** | mehaničke (warded, tumbler, combination), elektronske, biometrijske; svaka brava je **delay**, ne potpuna zaštita |
| **Čuvari** | jedina kontrola koja **procjenjuje i odlučuje**; skupi, ljudska greška |
| **Psi** | odvraćanje i detekcija; rizik odgovornosti |
| **Clean desk, zaključavanje ekrana** | zaštita informacija u radnom prostoru |
| **Privacy screens, zvučna izolacija** | shoulder surfing, prisluškivanje |
| **Posjetioci** | registracija, pratnja (escort), privremeni bedževi drugačije boje |
| **SCIF** | prostor za rad sa klasifikovanim informacijama (zaštita od emanacija i prisluškivanja) |

### Perimetar

| Kontrola | Detalji |
|---|---|
| **Ograde** | 1 m (3–4 ft) odvraća slučajne prolaznike; 2 m (6–7 ft) teško se preskače; 2,4 m (8 ft) sa bodljikavom žicom odvraća odlučne napadače; **PIDAS** ograde sa senzorima |
| **Bollards** | sprečavaju prolazak vozila do zgrade |
| **Rasvjeta** | ravnomjerna, bez tamnih zona; za kritične zone standard je oko 2 fc (stope-svijeće) na visini od 8 ft; rasvjeta usmjerena ka spolja, ne u oči čuvara |
| **CCTV** | odvraćanje, detekcija, dokaz; snimci sa vremenom; analitika |
| **Senzori (IDS)** | infracrveni (PIR), mikrotalasni, ultrazvučni, senzori loma stakla, magnetni kontakti na vratima, vibracioni |

### Vrste brava

| Brava | Karakteristika |
|---|---|
| **Warded / tumbler** (mehanička) | jeftina, ključevi se kopiraju, ranjiva na manipulaciju; samo delay |
| **Combination / cipher lock** | kod se dijeli i curi; treba ga redovno mijenjati |
| **Elektronska (kartica, PIN)** | evidencija ulazaka, brzo ukidanje prava, fail-safe/fail-secure podešavanje |
| **Biometrijska** | veže pristup za osobu; FAR/FRR i CER kao mjere tačnosti |

### Utilities i HVAC

| Parametar | Preporuka | Problem |
|---|---|---|
| **Temperatura** | ASHRAE preporučeni opseg **18–27 °C** za ulaz zraka | previsoka: pregrijavanje i otkazi |
| **Vlažnost** | oko **40–60%** relativne vlažnosti (ASHRAE danas koristi i tačku rose) | niska: **statički elektricitet**; visoka: **kondenzacija i korozija** |
| **Pritisak** | **pozitivan pritisak** u server sobi | zrak (dim, prašina) izlazi napolje, ne ulazi |
| **Zaštita HVAC sistema** | odvojen HVAC za DC, kontrolisan pristup komandama, gašenje ventilacije pri požaru | napadač kroz HVAC kontrole (BMS na mreži) može izazvati pregrijavanje |
| **Voda i gas** | poznata lokacija glavnih ventila, detekcija curenja | poplava od cijevi ili sprinklera |

BMS (building management system) i ICS komponente zgrade su dio napadne površine i treba ih **segmentirati** od korporativne mreže.

### Ekološki i ljudski uticaji (environmental issues)

| Kategorija | Primjeri | Kontrole |
|---|---|---|
| **Prirodne katastrofe** | zemljotres, poplava, oluja, šumski požar, pandemija | izbor lokacije, seizmičko učvršćivanje rackova, podignuta oprema, DR lokacija |
| **Ljudski (man-made), namjerni** | sabotaža, terorizam, krađa, vandalizam, nemiri | perimetar, kontrola pristupa, čuvari, CCTV |
| **Ljudski, nenamjerni** | požar zbog kvara, curenje vode, prekid kabla bagerom, greška operatera | redundansa, procedure, obuka, osiguranje |
| **Utility kvarovi** | nestanak struje, vode, telekoma | redundantni izvori, generatori, više provajdera |

## Požar: prevencija, detekcija i gašenje (3.9)

### Vatreni trougao i tetraedar

Požar treba **gorivo, kiseonik i toplotu**, uz **hemijsku lančanu reakciju** (tetraedar). Svako sredstvo za gašenje uklanja barem jedan element: voda hladi (toplota), CO₂ i inertni gasovi smanjuju kiseonik, pjena izoluje gorivo, FM-200 i halon prekidaju hemijsku reakciju.

### Klase požara

| Klasa (SAD) | Gorivo | Sredstvo | Napomena (EU klase) |
|---|---|---|---|
| **A** | obični zapaljivi materijali (papir, drvo, tkanina) | voda, pjena | EU A |
| **B** | zapaljive tečnosti i gasovi | CO₂, pjena, prah | EU B (tečnosti) i C (gasovi) |
| **C** | **električna oprema** pod naponom | CO₂, gasovi, **ne voda** | EU nema posebnu klasu; tretira se kao rizik |
| **D** | zapaljivi metali (magnezijum, natrijum) | suvi prah posebne namjene | EU D |
| **K** | ulja i masti u kuhinjama | mokra hemikalija (wet chemical) | EU F |

### Prevencija

Obuka zaposlenih, propisi o zapaljivim materijalima, uredni kablovi, protivpožarni zidovi i vrata, zabrana pušenja, redovne inspekcije, materijali otporni na vatru, jasni evakuacioni putevi i vježbe evakuacije.

### Detekcija

| Detektor | Kako radi | Prednost / mana |
|---|---|---|
| **Fixed-temperature** (toplotni) | aktivira se na određenoj temperaturi | malo lažnih alarma, ali reaguje kasno |
| **Rate-of-rise** (toplotni) | brz porast temperature | brži od fiksnog, više lažnih alarma |
| **Ionization** (dim) | dim prekida jonizovanu struju | brz za plamene požare |
| **Photoelectric/optical** (dim) | dim rasipa ili blokira svjetlost | brz za tinjajuće požare |
| **Aspirating (VESDA)** | usisava uzorke zraka i analizira čestice | najranija detekcija; za data centre |
| **Flame** (IR/UV) | detektuje zračenje plamena | brzo, skupo, za specifične prostore |

### Gašenje vodom (sprinkleri)

| Sistem | Kako radi | Kada |
|---|---|---|
| **Wet pipe** | cijevi stalno pune vode, svaka glava se otvara na toploti | najjeftiniji, pouzdan; rizik curenja i smrzavanja |
| **Dry pipe** | cijevi pune komprimovanog zraka; voda ulazi kada glava pukne | hladni prostori (smrzavanje), odgođeno puštanje vode |
| **Pre-action** | dvostruki okidač: detektor otvara ventil i puni cijevi, voda izlazi tek kada glava pukne | **preporučen za data centre** sa vodom: smanjuje rizik slučajnog curenja, daje vrijeme za gašenje ručnim aparatom |
| **Deluge** | otvorene glave, velika količina vode odjednom | skladišta zapaljivih materija, nije za IT opremu |

### Gašenje gasom

| Sredstvo | Princip | Napomena |
|---|---|---|
| **Halon 1301** | prekida hemijsku reakciju | **zabranjen za novu proizvodnju** (Montrealski protokol, ozonski omotač); postojeći sistemi zamjenjuju se |
| **FM-200 (HFC-227ea)**, **Novec 1230 (FK-5-1-12)** | hlađenje i prekid reakcije | **bezbjedni za ljude** u projektovanim koncentracijama, bez ostatka; za server sobe |
| **Inergen, Argonite** (inertni gasovi) | smanjuju kiseonik na nivo koji gasi požar, ali ljudi mogu disati kratko | bezbjedni za prisutne u projektovanim koncentracijama |
| **CO₂** | istiskuje kiseonik | **smrtonosan za ljude**; samo u prostorima bez ljudi ili uz odgodu i alarm za evakuaciju |

Ručni aparati se postavljaju na najviše oko 15 m (50 ft) od opreme. Sistem gašenja treba imati **odgodu i alarm** za evakuaciju i ručni **abort** taster, a pri aktivaciji automatski gasi HVAC i, po potrebi, napajanje opreme (EPO, emergency power off).

> **Na ispitu:** Ako se bira sistem gašenja za data centar u kojem rade ljudi, CO₂ je pogrešan odgovor jer ugrožava život. Najbolji izbori su **čisti agensi (FM-200, Novec 1230, inertni gasovi)** ili **pre-action** sprinkleri. Halon je zabranjen za nove instalacije. Voda na opremi pod naponom je opasna (klasa C).

## Napajanje (3.9)

### Problemi sa napajanjem

| Termin | Značenje |
|---|---|
| **Fault** | kratkotrajan potpuni nestanak |
| **Blackout** | dugotrajan potpuni nestanak |
| **Sag (dip)** | kratkotrajan pad napona |
| **Brownout** | dugotrajan pad napona |
| **Spike** | kratkotrajan visok napon |
| **Surge** | dugotrajan povišen napon |
| **Inrush** | početni udar struje pri uključivanju opreme |
| **Noise (EMI/RFI)** | smetnje; **EMI** od motora, kablova; **RFI** od radio uređaja, fluorescentnih svjetala |
| **Transient** | kratkotrajna smetnja na liniji |
| **Ground** | uzemljenje; loše uzemljenje izaziva smetnje i opasnost |

Mnemonik: riječi sa „kratko“ su prolazne (fault, sag, spike), a „dugo“ (blackout, brownout, surge).

### Kontrole

| Kontrola | Štiti od |
|---|---|
| **Surge protector** | spike i surge |
| **Power conditioner / line conditioner** | noise, sag, spike (čisti signal) |
| **UPS** (online/double-conversion, line-interactive, standby/offline) | kratki nestanci i smetnje; daje vrijeme za uredno gašenje ili start generatora. **Online UPS** stalno napaja opremu iz baterije i daje najčišće napajanje |
| **Generator** (dizel, gas) | dugotrajni nestanci; treba gorivo za definisan period, ugovor o isporuci goriva, redovno testiranje pod opterećenjem |
| **Redundantni izvori (A/B feed)** | kvar jednog izvora ili trafostanice; dvostruki napojni moduli u serverima |
| **PDU sa monitoringom** | preopterećenje, praćenje potrošnje |
| **EPO** | hitno isključenje radi zaštite ljudi (zaštićen poklopcem od slučajnog pritiska) |
| Oklopljeni kablovi, odvajanje strujnih i data kablova | EMI |

> **Na ispitu:** UPS nije zamjena za generator: UPS premošćuje **minute** (do starta generatora ili urednog gašenja), generator pokriva **sate i dane**. Pitanje o „čistom napajanju“ bez smetnji traži **power conditioner** ili **online UPS**.

## Upravljanje životnim ciklusom informacionog sistema (3.10)

### Okvir

Cilj 3.10 prati **ISO/IEC/IEEE 15288** i **NIST SP 800-160 Vol. 1** (Systems Security Engineering): sigurnost se ugrađuje u **tehničke procese** sistemskog inženjeringa, od ideje do uklanjanja. SDLC (razvoj softvera) je dio šire slike i detaljno se obrađuje u domenu 8; **system life cycle (SLC)** obuhvata i operacije i povlačenje.

| Faza / proces | Sigurnosne aktivnosti | Ključni izlaz |
|---|---|---|
| **Stakeholder needs and requirements** | identifikacija svih zainteresovanih strana (vlasnik, korisnici, regulator, operacije, sigurnost, privatnost), zaštitne potrebe, zakonski zahtjevi, prihvatljiv rizik | zaštitne potrebe (protection needs), CONOPS |
| **Requirements analysis** | prevođenje potreba u mjerljive sigurnosne zahtjeve (funkcionalne i assurance), kategorizacija (FIPS 199), threat modeling, sljedljivost (traceability) | specifikacija sigurnosnih zahtjeva |
| **Secure architectural design** | principi sigurnog dizajna (3.1), sigurnosna arhitektura, izbor kontrola, trust boundaries, ponovni threat modeling, review dizajna | sigurnosna arhitektura, SSP nacrt |
| **Development / implementation** | sigurno kodiranje, ojačane komponente, SAST/SCA, sigurna konfiguracija, SBOM | implementirani elementi sistema |
| **Integration** | sigurno spajanje komponenti, interfejsi i API-ji, testiranje interoperabilnosti i sigurnosti interfejsa | integrisani sistem |
| **Verification and validation** | V: da li je sistem **izgrađen prema zahtjevima**; V: da li **ispunjava potrebe** korisnika u stvarnom okruženju; DAST, pentest, procjena kontrola | dokazi za autorizaciju |
| **Transition / deployment** | sigurno uvođenje u produkciju, migracija podataka, obuka, **autorizacija (ATO)**, rollback plan, uklanjanje testnih naloga i podataka | sistem u produkciji |
| **Operations and maintenance / sustainment** | patch i change management, konfiguracioni baseline, monitoring, upravljanje ranjivostima, periodične procjene, IR | siguran rad tokom vijeka |
| **Retirement / secure disposal** | plan povlačenja, arhiviranje po retention zahtjevima, sanitizacija medija (NIST SP 800-88), ukidanje pristupa i integracija, ažuriranje inventara | dokumentovano, sigurno povlačenje |
| **Continuous security review** | kroz **sve** faze: kontinuirani monitoring (ISCM, NIST SP 800-137), ponovna procjena rizika pri promjenama, revizije, metrike | ažuriran profil rizika |

### Verifikacija vs validacija

| | Verification | Validation |
|---|---|---|
| Pitanje | „Da li gradimo sistem **ispravno**?“ (building the system right) | „Da li gradimo **ispravan** sistem?“ (building the right system) |
| Poredi sa | specifikacijom i zahtjevima | stvarnim potrebama korisnika i misije |
| Metode | inspekcija, review, testiranje prema specifikaciji, analiza | korisničko testiranje (UAT), operativno testiranje, pilot |

> **Na ispitu:** Sigurnosni zahtjevi se definišu **na početku** (stakeholder needs i requirements analysis), a ne nakon implementacije. Ako pitanje pita kada je NAJJEFTINIJE i NAJEFIKASNIJE uključiti sigurnost, odgovor je najranija faza. Ako pita ko treba biti uključen od početka, odgovor je sigurnosni stručnjak zajedno sa vlasnikom sistema i ostalim zainteresovanim stranama.

### Sljedljivost i upravljanje konfiguracijom

- **Requirements traceability matrix (RTM)** povezuje svaki sigurnosni zahtjev sa dizajnom, implementacijom i testom. Omogućava dokaz da je svaki zahtjev ispunjen i da nema funkcionalnosti bez zahtjeva.
- **Configuration management** u svim fazama: baseline, kontrola verzija, kontrola promjena (CCB/CAB), audit konfiguracije.
- **Change management** u operacijama: svaka promjena prolazi procjenu sigurnosnog uticaja (security impact analysis), a značajne promjene mogu tražiti ponovnu autorizaciju.

### Modeli razvoja i životni ciklus

| Model | Karakteristika | Sigurnosna napomena |
|---|---|---|
| **Waterfall** | sekvencijalne faze | sigurnost lako planirati, ali kasna otkrića su skupa |
| **V-model** | svaka faza razvoja ima odgovarajuću fazu verifikacije/validacije | jasna veza zahtjev–test |
| **Spiral** | iterativno uz analizu rizika u svakom krugu | rizik u centru |
| **Agile / DevOps / DevSecOps** | kratke iteracije, automatizacija | sigurnost kao dio pipelinea („shift left“), kontinuirana provjera |

### Transition i sustainment

- **Prije puštanja u rad**: uklanjanje razvojnih naloga, debug koda, testnih podataka (posebno stvarnih ličnih podataka u testu), maintenance hookova.
- **Paralelni rad** starog i novog sistema, pilot, fazno uvođenje ili big-bang: izbor zavisi od rizika; za kritične sisteme paralelni rad smanjuje rizik.
- **Sustainment**: dobavljači i podrška (EOS datumi, 2.5), rezervni dijelovi, ažurna dokumentacija, obuka novih operatera.

### Retirement / secure disposal

1. Plan povlačenja kao dio životnog ciklusa (ne improvizacija).
2. Identifikacija podataka za arhiviranje i rokova čuvanja (retention, legal hold).
3. Migracija na zamjenski sistem i provjera integriteta migriranih podataka.
4. Ukidanje naloga, ključeva, certifikata, integracija, DNS zapisa i firewall pravila.
5. Sanitizacija medija (clear/purge/destroy prema klasifikaciji) i certifikat uništenja.
6. Ažuriranje inventara, CMDB-a i dokumentacije autorizacije.

## Scenariji

**Scenarij 1: požar u server sobi sa operaterima.** Novi data centar planira CO₂ sistem jer je jeftin. Ispravna preporuka: čisti agens (FM-200/Novec/inertni gas) ili pre-action sprinkleri, uz odgodu, alarm i abort taster; CO₂ samo za prostore u kojima ljudi ne borave.

**Scenarij 2: tailgating.** Zaposleni drže vrata posjetiocima iz ljubaznosti. Tehnička kontrola: mantrap ili turnstile; administrativna: obuka i politika; detektivna: CCTV i analiza logova pristupa.

**Scenarij 3: vlažnost.** Nakon instalacije novog HVAC-a vlažnost pada na 20% i oprema se povremeno resetuje. Uzrok je **statički elektricitet**; rješenje je ovlaživanje na preporučeni opseg i antistatičke mjere.

**Scenarij 4: sistem bez zahtjeva.** Projekat je stigao do testiranja, a sigurnosni tim tek tada dobija dokumentaciju. Pentest otkriva arhitektonske propuste koje je skupo ispraviti. Lekcija: sigurnost od faze potreba i zahtjeva, threat modeling u dizajnu, kontinuirani security review.

## Brzi pregled pojmova

| Pojam | Jedna rečenica |
|---|---|
| CPTED | sprečavanje kriminala dizajnom prostora (vidljivost, usmjeravanje, teritorija, održavanje) |
| IDF / MDF | razvodni ormar po spratu / glavna telekom tačka zgrade |
| Mantrap | dvoja vrata koja se ne mogu otvoriti istovremeno; protiv tailgatinga |
| PIDAS | ograda sa senzorima za detekciju prodora |
| Pre-action | sprinkler sa dvostrukim okidačem; standard za data centre sa vodom |
| VESDA | aspiracioni detektor dima za najraniju detekciju |
| EPO | taster za hitno isključenje napajanja radi zaštite ljudi |
| Brownout / sag | dugotrajan / kratkotrajan pad napona |
| Surge / spike | dugotrajan / kratkotrajan porast napona |
| Online UPS | stalno napajanje kroz bateriju, najčistiji izlaz |
| RTM | matrica koja povezuje zahtjev sa dizajnom, kodom i testom |
| ISCM | kontinuirani monitoring sigurnosti informacija (NIST SP 800-137) |
| Verification / validation | prema specifikaciji / prema stvarnim potrebama |

> **Na ispitu:** U pitanjima o fizičkoj sigurnosti često su ponuđene skupe tehnologije (biometrija, analitika videa) i jednostavne mjere (rasvjeta, ograde, procedure). Ako pitanje traži NAJISPLATIVIJU ili PRVU mjeru za odvraćanje, često je to **rasvjeta** ili jasna kontrola pristupa; ako traži jedinu kontrolu koja može **procijeniti situaciju i donijeti odluku**, odgovor je **čuvar**.

## Rezime

- Dizajn lokacije: slojevi (deter, deny, detect, delay, respond), CPTED (natural surveillance, natural access control, territorial reinforcement, maintenance), neupadljiva lokacija, kritične prostorije u centru zgrade, zidovi do konstrukcijske ploče.
- Prostori: IDF/MDF zaključani i nadzirani; data centar sa mantrapom, hot/cold aisle, A/B napajanjem, Tier nivoima; media storage sa klimatskim uslovima i evidencijom; evidence storage sa strogim chain of custody.
- HVAC: 18–27 °C, vlažnost oko 40–60% (niska → statika, visoka → korozija), pozitivan pritisak; BMS segmentirati.
- Požar: tetraedar, klase A/B/C/D/K, detektori (toplotni, dimni, VESDA), sprinkleri (wet, dry, **pre-action za DC**, deluge), čisti agensi bezbjedni za ljude, **CO₂ ugrožava život**, halon zabranjen.
- Napajanje: fault/blackout, sag/brownout, spike/surge, noise; surge protector, conditioner, UPS (minute), generator (sati), dvostruki izvori.
- Životni ciklus sistema (ISO 15288, NIST SP 800-160): potrebe, zahtjevi, siguran dizajn, implementacija, integracija, verifikacija i validacija, tranzicija, operacije, sigurno povlačenje, uz **kontinuirani security review** kroz sve faze. Verifikacija = prema specifikaciji; validacija = prema stvarnim potrebama.
