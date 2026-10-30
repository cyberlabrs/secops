## Šta ovaj modul pokriva

Modul pokriva dva cilja iz domena 5:

- **5.1** Emulacija napadača: **Atomic Red Team**, **Stratus Red Team**, **MITRE Caldera**; **purple teaming**.
- **5.2** Validacija detekcija i **analiza praznina** (gap analysis).

Poslije modula znaš:

- čemu služe okviri za emulaciju i po čemu se razlikuju;
- kako izgleda bezbjedan, dogovoren purple team test i ko šta radi u njemu;
- kako se detekcija validira na tri nivoa: jedinični test nad uzorkom loga, test u okruženju, regresija u CI-ju;
- kako se rezultati pretvaraju u matricu pokrivenosti, listu praznina i plan rada.

Ugao je **odbrambeni**. Ne učimo kako izvesti tehniku, nego kako dokazati da je naša detekcija vidi. Konkretni testovi se pokreću samo u izolovanom labu ili uz pisano odobrenje vlasnika sistema.

## Zašto emulacija

Detekcija koja nikad nije vidjela događaj koji treba da uhvati je **pretpostavka**, ne kontrola. Pravila se kvare tiho:

- agent prestane slati logove ili se promijeni format (nova verzija sshd-a, drugi `log_format`);
- neko doda preširok izuzetak;
- update ruleseta promijeni ID ili nivo pravila;
- SIEM pravilo radi, ali alarm ne stiže do reda za trijažu.

Nijedan od ovih kvarova ne pravi grešku. Vidiš ih tek kad napad prođe neprimijećen, ili kad ga sam izazoveš u kontrolisanim uslovima.

Pojmovi koje treba razlikovati:

| Pojam | Cilj | Ko zna za test |
|---|---|---|
| **Penetration test** | Naći ranjivosti i dokazati da su iskoristive | Obično SOC zna |
| **Red team** | Postići cilj (npr. pristup podacima) kao stvarni napadač, testirati i ljude i procese | Malo ljudi (tzv. white cell) |
| **Adversary emulation** | Ponoviti TTP-ove poznate grupe ili scenarija, mapirane na ATT&CK | Zavisi od dogovora |
| **Adversary simulation / BAS** | Automatizovano i ponovljivo pokretati pojedinačne tehnike (Breach and Attack Simulation) | Uglavnom svi |
| **Purple team** | Red i blue rade zajedno, tehniku po tehniku, da poboljšaju detekciju | Svi, otvoreno |

Purple team nije poseban tim nego **način rada**: napadačka strana izvede tehniku, odbrana odmah gleda šta je vidjela, i obje strane zajedno popravljaju praznine. Rezultat nije „pobjeda“, nego bolja pravila i telemetrija.

> **U praksi:** za mali tim najveću vrijednost daju mali, česti i ponovljivi testovi pojedinačnih tehnika (atomic pristup), a ne veliki godišnji red team. Red team pokazuje da li organizacija kao cjelina reaguje; atomic testovi pokazuju da li pravilo X još radi poslije prošlonedjeljnog updatea.

## Okviri za emulaciju

### Atomic Red Team

**Atomic Red Team** (Red Canary) je biblioteka malih testova, organizovanih po ATT&CK tehnikama. Svaka tehnika ima YAML fajl `atomics/T<ID>/T<ID>.yaml` sa jednim ili više testova. Test ima:

| Ključ | Značenje za odbranu |
|---|---|
| `attack_technique`, `display_name` | Koja tehnika se testira |
| `name`, `auto_generated_guid` | Ime i stabilan GUID testa; GUID upisuješ u izvještaj da bi alarm povezao sa testom |
| `supported_platforms` | `linux`, `macos`, `windows`, cloud platforme |
| `input_arguments` | Parametri sa podrazumijevanim vrijednostima (npr. ime naloga) |
| `dependencies` | Preduslovi i kako se provjeravaju |
| `executor.name` | `sh`, `bash`, `powershell`, `command_prompt` ili `manual` |
| `executor.elevation_required` | Treba li root/admin |
| `executor.cleanup_command` | Kako se vraća stanje poslije testa |

Testove pokreće PowerShell modul **Invoke-AtomicRedTeam** (radi i na Linuxu sa PowerShellom), ili ih pokreće Caldera kroz atomic plugin, ili ih čitaš i reprodukuješ ručno. Testovi su namjerno jednostavni: cilj je proizvesti očekivanu telemetriju, ne zaobići odbranu.

YAML fajlovi u `atomics/` korisni su i bez pokretanja: to je **katalog očekivane telemetrije** po tehnici. Testove pokreći samo u izolovanom testnom okruženju, uz odobrenje i dogovorena pravila (vidi „Pravila angažmana“ ispod); lab ovog kursa ih ne sadrži.

Za odbranu iz testa izvlačiš tri stvari: **koja tehnika**, **na kojoj platformi**, i **kakav trag ostavlja** (koji proces, koji fajl, koja linija u logu). Npr. test za T1136.001 na Linuxu kreira lokalni nalog alatom `useradd`, pa očekivana telemetrija izgleda ovako:

```text
Oct 14 09:12:44 lab useradd[2214]: new user: name=purple_t1136, UID=999, GID=65534, home=/home/purple_t1136, shell=/bin/bash, from=/dev/pts/0
```

I očekivana detekcija u Wazuhu: pravilo **5902** (`New user added to the system`, nivo 8, MITRE T1136).

### Stratus Red Team

**Stratus Red Team** (Datadog) je „Atomic Red Team za cloud“. Jedan Go binarni fajl, tehnike za AWS, Azure, GCP, Microsoft Entra ID, Kubernetes i EKS. ID tehnike prati obrazac `platforma.taktika.ime`, npr. `aws.defense-evasion.cloudtrail-stop` ili `aws.exfiltration.ec2-share-ebs-snapshot`.

Svaka tehnika ima **životni ciklus**:

| Stanje | Šta se dešava |
|---|---|
| **warmup** | Terraformom se kreiraju preduslovi (npr. trail, bucket, snapshot) |
| **detonate** | Izvodi se sama tehnika |
| **revert** | Poništavaju se efekti detonacije, ako tehnika to podržava |
| **cleanup** | Brišu se preduslovi; ništa ne ostaje u nalogu |

Za odbranu je bitno:

- Testovi se rade u **posebnom, izolovanom cloud nalogu** (sandbox), nikad u produkciji.
- Stratus nudi **correlation ID** koji se može upisati u tagove resursa, pa alarm u SIEM-u povezuješ sa testom.
- Trag se gleda u CloudTrailu: `eventName` (`StopLogging`, `ModifySnapshotAttribute`…), `userIdentity.arn` test-role i `sourceIPAddress`. To su isti upiti kao u modulima 02 i 06.

### MITRE Caldera

**Caldera** je platforma za automatizovanu emulaciju. Server upravlja **agentima** na ciljnim mašinama i izvodi cijele scenarije, ne samo pojedinačne tehnike.

| Pojam | Značenje |
|---|---|
| **Agent** | Program na meti koji se periodično javlja serveru po instrukcije (npr. Sandcat, Manx, Ragdoll); identifikuje ga `paw` |
| **Ability** | Implementacija jedne ATT&CK tehnike: komande, platforme, parser izlaza |
| **Adversary** | Profil: skup abilitya koji predstavlja TTP-ove neke grupe |
| **Operation** | Pokretanje adversary profila nad grupom agenata |
| **Fact** | Podatak naučen tokom operacije (korisnik, host), koji koriste kasnije abilityji |
| **Planner** | Logika koja odlučuje redoslijed abilityja |
| **Plugin** | Proširenje (npr. uvoz Atomic testova, izvještaji, emulacioni planovi) |

Caldera je korisna kad želiš testirati **lanac** (izvršenje → otkrivanje → perzistencija), jer neke detekcije gledaju korelaciju, a ne pojedinačan događaj. Cijena je složenost: server, agenti koji su sami po sebi C2 kanal, i potreba da se agent poslije testa ukloni.

### Poređenje

| | Atomic Red Team | Stratus Red Team | Caldera |
|---|---|---|---|
| Fokus | Endpoint (Windows, Linux, macOS), nešto clouda | Cloud i Kubernetes | Endpoint, scenariji |
| Jedinica | Jedan test po tehnici | Jedna tehnika sa životnim ciklusom | Operacija (lanac abilityja) |
| Pokretanje | Invoke-AtomicRedTeam, ručno, Caldera | `stratus` CLI | Web UI / API, agenti |
| Čišćenje | `cleanup_command` | `revert`, `cleanup` | Zavisi od abilityja; agent se uklanja |
| Najbolje za | Regresiju pojedinačnih pravila | Validaciju CloudTrail i K8s detekcija | Purple team vježbe sa lancem napada |

Postoje i drugi izvori: Falco **event-generator** proizvodi događaje za Falco pravila, a MITRE Center for Threat-Informed Defense objavljuje **Adversary Emulation Library** sa planovima za konkretne grupe. U Microsoft svijetu (SC-200) Defender XDR i Sentinel imaju pregled pokrivenosti prema ATT&CK-u, ali sam test i dalje moraš izvesti.

> **U praksi:** prije nego što pokreneš ijedan alat, pročitaj test koji će izvesti. Neki testovi mijenjaju sistem (brišu logove, mijenjaju firewall, gase servise), neki skidaju dodatne fajlove sa interneta. U okruženju koje dijeliš sa drugima to može izazvati pravi incident ili prekid servisa.

## Pravila angažmana

Svaki test, i najmanji, treba **pravila angažmana** (rules of engagement). Minimum:

| Stavka | Primjer |
|---|---|
| Odobrenje | Pisano, od vlasnika sistema; ime i datum |
| Opseg | Hostovi, nalozi, namespace; šta je izričito van opsega |
| Vrijeme | Prozor izvođenja; ko je dežuran |
| Obavještenje | Zna li SOC (otvoreni test) ili ne (slijepi test, uz white cell koji može prekinuti) |
| Prekid | Ko i kako zaustavlja test; kontakt telefon |
| Podaci | Bez stvarnih ličnih podataka i tajni; lažni nalozi i ključevi |
| Trag testa | Za svaki korak: vrijeme (UTC), host, korisnik, tehnika, GUID testa |
| Čišćenje | Ko provjerava da je stanje vraćeno; kako se to potvrđuje |

Trag testa je ključan. Bez njega analitičar ne može reći da li je alarm u 09:12 bio test ili pravi napad koji se slučajno poklopio. Dobra praksa je da testni nalozi i resursi imaju prepoznatljiv prefiks (`purple_`), da test nosi oznaku u tagu ili komentaru, i da se dnevnik testa čuva uz izvještaj.

## Purple team proces

Jedan ciklus izgleda ovako:

1. **Izbor tehnika.** Polazi od prijetnji relevantnih za tebe (threat intel, prethodni incidenti, ATT&CK grupe koje napadaju tvoj sektor), ne od abecede ATT&CK matrice.
2. **Hipoteza.** Za svaku tehniku zapiši šta **očekuješ**: koji log izvor, koje polje, koje pravilo (Wazuh ID, Sigma ID, Falco ime), koji nivo i koja ATT&CK oznaka.
3. **Izvođenje.** Red strana izvodi test i bilježi tačno vrijeme i parametre.
4. **Posmatranje.** Blue strana provjerava redom: da li je događaj **zabilježen**, da li je stigao u SIEM, da li je **alarm** nastao, da li je nivo ispravan, da li alarm ima dovoljno konteksta za trijažu.
5. **Analiza.** Gdje je lanac pukao?
6. **Popravka.** Nova telemetrija, novo pravilo, ispravka izuzetka, bolji output.
7. **Ponovni test.** Isti test, isti parametri. Tek kad prođe, praznina je zatvorena.

Rezultat svake tehnike klasifikuj na skali. Primjer skale koju koristimo u kursu:

| Ocjena | Značenje |
|---|---|
| 0 Nema telemetrije | Događaj nije nigdje zabilježen |
| 1 Telemetrija | Log postoji (u SIEM-u ili na hostu), ali nema alarma |
| 2 Alarm | Pravilo se okinulo, ali nivo, mapiranje ili kontekst nisu dovoljni |
| 3 Detekcija | Alarm ispravnog nivoa, sa ATT&CK oznakom i kontekstom za trijažu |
| 4 Odgovor | Alarm je trijažiran po runbooku u dogovorenom vremenu |

Ocjene 0 i 1 traže različite popravke. Kod 0 problem je **vidljivost** (nema agenta, auditd pravila, CloudTrail data eventa, Kubernetes audit nivoa). Kod 1 problem je **logika** (nema pravila, preuzak uslov, preširok izuzetak).

> **U praksi:** najčešći rezultat prvog purple team dana nije „nemamo pravilo“, nego „pravilo postoji, ali log nikad ne stiže“. Zato u hipotezi uvijek zapiši i očekivani log izvor, i prvo provjeri njega. Tek kad je telemetrija tu, ima smisla raspravljati o pravilu.

## Validacija detekcija

Validacija ima tri sloja. Svaki hvata druge kvarove.

| Sloj | Šta testira | Alat u labu | Kada |
|---|---|---|---|
| Jedinični test | Logiku pravila nad poznatim uzorkom | `wazuh-logtest`, Zircolite, Falco replay | Pri svakoj izmjeni pravila (CI) |
| Test u okruženju | Cijeli lanac: senzor → prikupljanje → SIEM → alarm | Emulacija tehnike u labu | Periodično i poslije većih izmjena |
| Zdravlje detekcija | Da li izvori i pravila uopšte rade | Heartbeat, broj događaja po izvoru, „tiha“ pravila | Stalno (dashboard, alarm) |

### Jedinični test: uzorak loga

Najjeftiniji test ne mijenja sistem: daš pravilu uzorak loga koji predstavlja tehniku. Za Wazuh:

```bash
echo 'Oct 14 09:12:44 lab useradd[2214]: new user: name=purple_t1136, UID=999, GID=65534, home=/home/purple_t1136, shell=/bin/bash, from=/dev/pts/0' \
  | /var/ossec/bin/wazuh-logtest 2>&1 | grep -E "id:|level:|description:|mitre"
# očekivano: id: '5902', level: '8', description: 'New user added to the system.'
```

Za Sigma pravilo: uzorak u JSON obliku i Zircolite (modul 06). Za Falco: replay `.scap` snimka (modul 07). Uzorci se čuvaju uz pravilo u repou: `tests/positive/` (mora se okinuti) i `tests/negative/` (legitimna aktivnost, ne smije se okinuti).

Ograničenje: jedinični test dokazuje da **pravilo** radi nad tim uzorkom. Ne dokazuje da će se takav log pojaviti u produkciji, niti da format nije drugačiji.

### Test u okruženju

Ovdje tehniku stvarno izvodiš (u labu, po pravilima angažmana) i gledaš da li alarm stiže tamo gdje treba. Za lab primjer T1136.001 provjera izgleda ovako:

```bash
# 1) telemetrija na hostu
grep 'new user: name=purple_' /var/log/auth.log

# 2) alarm u Wazuhu, u vremenskom prozoru testa
jq -c 'select(.rule.id=="5902") | {t:.timestamp, lvl:.rule.level, mitre:.rule.mitre.id, log:.full_log}' \
   /var/ossec/logs/alerts/alerts.json | tail -3

# 3) čišćenje i provjera čišćenja
getent passwd | grep '^purple_' || echo "nema testnih naloga"
```

Sintetički log (npr. `logger -p auth.info -t useradd ...`) je srednji put: provjerava prikupljanje i SIEM, ali ne i senzor. Kad ga koristiš, u izvještaju napiši da je test bio sintetički.

### Regresija i zdravlje

- **Regresija u CI-ju:** svaki merge u repo detekcija pokreće sve jedinične testove. Pravilo koje više ne hvata pozitivan uzorak ruši build.
- **Tiha pravila:** pravilo koje mjesecima nije okinulo nije nužno dobro. Možda je izvor prestao slati logove. Periodični atomic test za kritična pravila to otkriva.
- **Zdravlje izvora:** alarm kad broj događaja sa nekog izvora padne na nulu (Wazuh agent disconnected, CloudTrail `StopLogging`, prazan Kubernetes audit log).

```bash
# koliko alarma po pravilu u posljednjem fajlu, i koja očekivana pravila nedostaju
jq -r '.rule.id' /var/ossec/logs/alerts/alerts.json | sort | uniq -c | sort -rn | head
for id in 5902 5715 5402 100200; do
  n=$(jq -r --arg id $id 'select(.rule.id==$id) | .rule.id' /var/ossec/logs/alerts/alerts.json | wc -l)
  echo "$id $n"
done
```

## Analiza praznina (gap analysis)

Analiza praznina odgovara na pitanje: **za tehnike koje su nam bitne, šta vidimo, šta detektujemo i šta smo provjerili?**

Postupak:

1. **Lista prioritetnih tehnika.** Iz threat profila: npr. za cloud-native firmu T1078.004 (cloud nalozi), T1552 (kredencijali u fajlovima), T1610 (deploy kontejnera), T1496 (resource hijacking, kriptomineri), T1562.008 (gašenje cloud logova), T1136 (kreiranje naloga).
2. **Inventar detekcija.** Za svaku tehniku: koja pravila postoje (Wazuh, Sigma, Falco) i iz kojeg izvora.
3. **Inventar telemetrije.** Koji izvori zaista stižu u SIEM i sa kojih sistema. ATT&CK od v18 opisuje detekcije kroz **Detection Strategies** i **Analytics** povezane sa **Data Components**, pa za svaku tehniku vidiš koje komponente podataka su potrebne.
4. **Rezultati testova.** Ocjena 0–4 iz purple team testa, sa datumom.
5. **Prioritizacija praznina.** Relevantnost tehnike × težina popravke × posljedica ako je propustimo.

Primjer matrice:

| Tehnika | Izvor | Pravilo | Zadnji test | Ocjena | Praznina |
|---|---|---|---|---|---|
| T1136.001 lokalni nalog | auth.log | Wazuh 5902 | 2026-10-14 | 3 | — |
| T1059.004 shell iz web servera | syscalli (Falco) | `Shell pokrenut iz web servera` | 2026-10-14 | 2 | Output bez slike kontejnera |
| T1562.008 gašenje CloudTraila | CloudTrail | Sigma `StopLogging` | 2026-10-10 | 3 | — |
| T1552.001 kredencijali u fajlovima | auditd | nema | 2026-10-14 | 1 | Nema pravila; auditd watch postoji |
| T1496 kriptominer u podu | syscalli, metrike | nema | nije testirano | 0 | Nema telemetrije mrežnih konekcija iz poda |

Rezultat se crta u **ATT&CK Navigator** sloju (modul 05): `score` po tehnici je ocjena, boja pokazuje pokrivenost, a `comment` nosi datum testa i ime pravila. Dva sloja (prije i poslije purple team ciklusa) daju mjerljiv napredak.

Metrike koje vrijedi pratiti:

- procenat prioritetnih tehnika sa ocjenom ≥ 3;
- starost zadnje validacije po pravilu (pravilo netestirano duže od 90 dana je kandidat za test);
- vrijeme od izvođenja testa do alarma u redu za trijažu;
- broj praznina otvorenih i zatvorenih po ciklusu.

> **U praksi:** ne boji cijelu ATT&CK matricu zeleno. Pravilo koje „pokriva“ tehniku jednim uskim indikatorom (ime alata) nije isto što i pokrivenost tehnike. U komentaru u Navigatoru napiši **šta** pravilo zaista hvata (koju proceduru), da sljedeći analitičar ne bi mislio da je tehnika riješena.

## Česte greške

| Greška | Posljedica | Kako izbjeći |
|---|---|---|
| Test bez hipoteze | Ne znaš je li rezultat dobar ili loš | Prije testa zapiši izvor, pravilo, nivo, ATT&CK oznaku |
| Test bez dnevnika vremena | Alarm se ne može povezati sa testom | UTC vrijeme, host, korisnik, GUID za svaki korak |
| Pravilo „podešeno“ da hvata baš ime testnog alata | Detekcija prolazi test, ali ne hvata stvarnu tehniku | Pravilo gradi na ponašanju (proces, putanja, syscall), ne na imenu testa |
| Testni nalozi i resursi ostanu | Pravi napadač ih može iskoristiti; šum u budućim istragama | Provjera čišćenja kao poseban korak sa potpisom |
| Samo jedna procedura po tehnici | Lažan osjećaj pokrivenosti | Za važne tehnike testiraj više varijanti (drugi alat, druga putanja) |
| Rezultati ostanu u prezentaciji | Praznine se ne zatvaraju | Svaka praznina je tiket sa vlasnikom i rokom |
| Test u produkciji bez odobrenja | Prekid servisa, pravi incident | Pravila angažmana, prozor, kontakt za prekid |

Posebno pazi na treću grešku. Ako Atomic test kreira nalog sa podrazumijevanim imenom, pravilo koje traži baš to ime prolazi svaki test, a ne hvata ništa drugo. Mijenjaj `input_arguments` (drugo ime, druga putanja) između ciklusa, upravo da bi provjerio da pravilo hvata tehniku, a ne test.

## Izvještaj o testu

Svaki ciklus završava kratkim izvještajem koji ide uz repo detekcija:

```text
Purple team ciklus 2026-10-14, lab-det-01
Opseg: Linux host lab, Wazuh 4.14, Falco 0.45 (replay); bez produkcije
Odobrenje: vlasnik platforme, tiket SEC-412

T1136.001  test GUID 40d8eabd-...  09:12:44Z  telemetrija: da  alarm: 5902 (lvl 8)  ocjena 3
T1059.004  falco replay run-shell-untrusted  alarm: Run shell untrusted  ocjena 2  -> SEC-415 (output)
T1552.001  sintetički log  alarm: nema  ocjena 1  -> SEC-416 (novo Sigma pravilo nad auditd)

Čišćenje: testni nalozi uklonjeni (getent bez purple_), provjerio: blue
Sljedeći test: 2026-11-11 (regresija svih ocjena >= 3)
```

## Rezime

- Emulacija dokazuje da detekcija radi; netestirano pravilo je pretpostavka. Purple team je saradnja red i blue strane tehniku po tehniku.
- **Atomic Red Team**: mali testovi po tehnici (`atomics/T<ID>/T<ID>.yaml`, GUID, platforme, `cleanup_command`). **Stratus Red Team**: cloud i Kubernetes tehnike sa ciklusom warmup → detonate → revert → cleanup. **Caldera**: agenti, abilityji, adversary profili i operacije za lance napada.
- Svaki test ima pravila angažmana: odobrenje, opseg, vrijeme, prekid, lažni podaci, dnevnik testa i provjeru čišćenja.
- Proces: izbor tehnika iz threat profila → hipoteza (izvor, pravilo, nivo) → izvođenje → posmatranje → popravka → ponovni test.
- Validacija ima tri sloja: jedinični test nad uzorkom (`wazuh-logtest`, Zircolite, Falco replay), test u okruženju i stalno praćenje zdravlja izvora i pravila.
- Analiza praznina spaja prioritetne tehnike, telemetriju, pravila i ocjene testova u matricu i Navigator sloj; razlikuj prazninu u vidljivosti od praznine u logici.
- Mjeri procenat validiranih prioritetnih tehnika i starost zadnje validacije, ne broj pravila.
