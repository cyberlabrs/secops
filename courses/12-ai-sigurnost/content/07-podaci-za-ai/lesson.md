## Šta ovaj modul pokriva

Domen 3, RAG i podaci:

- **3.2** Zaštita podataka u AI-ju: lični podaci, upravljanje podacima za treniranje, odbrana od trovanja podataka.

Poslije ovog modula treba da znaš:

- da mapiraš gdje lični podaci ulaze u AI sistem i gdje mogu izaći (treniranje, promptovi, logovi, povratne informacije),
- da primijeniš principe zaštite podataka (minimizacija, ograničenje svrhe, zadržavanje) na treniranje i inferenciju,
- da uspostaviš upravljanje skupovima podataka: inventar, porijeklo, verzionisanje, licence, pristup,
- da objasniš klase trovanja podataka po NIST AI 100-2 i OWASP **LLM04:2025 Data and Model Poisoning** i postaviš kontrole u data pipeline,
- da povežeš ove kontrole sa zahtjevima EU AI Acta za podatke kod visokorizičnih sistema.

## Podaci kroz životni ciklus AI sistema

Kod klasične aplikacije podaci su u bazi i u logovima. Kod AI sistema podaci prolaze kroz više mjesta, a neka od njih je teško „očistiti“ poslije:

```text
 prikupljanje ─► označavanje ─► skup za treniranje ─► treniranje / fine-tuning ─► model
     │              │                 │                        │                  │
  izvori,       ljudi ili         verzionisan            težine mogu          inferencija
  licence,      dobavljači        snapshot (hash)        memorisati             │
  saglasnost    (pristup!)                                podatke               ▼
                                                                    promptovi, odgovori, logovi
                                                                                │
        ◄────────────── povratna petlja: ocjene korisnika, novi primjeri ◄──────┘
```

| Mjesto | Rizik | Primarna kontrola |
|---|---|---|
| Prikupljanje | Podaci bez pravnog osnova ili licence | Inventar izvora, pravni osnov, licenca po izvoru |
| Označavanje | Pristup ljudi ili dobavljača osjetljivim podacima; namjerno pogrešne oznake | Pseudonimizacija prije označavanja, ugovor, kontrola kvaliteta oznaka |
| Skup za treniranje | Trovanje, neovlaštena izmjena, nepoznato porijeklo | Nepromjenjivi snapshotovi sa hashom, kontrola pristupa, provjera |
| Težine modela | Memorisanje i reprodukcija ličnih podataka | Minimizacija i deduplikacija prije treniranja, evaluacija curenja |
| Promptovi i logovi | Korisnici unose lične i poslovne tajne | Redakcija, zadržavanje, pristup logovima, uslovi dobavljača |
| Povratna petlja | Trovanje kroz ocjene i primjere korisnika | Review prije ponovnog treniranja, nivoi povjerenja |

## Lični podaci u AI sistemima

### Principi koji važe i za modele

**GDPR** u EU i **Zakon o zaštiti podataka o ličnosti** (ZZPL) u Srbiji, koji je u velikoj mjeri usklađen sa GDPR-om, ne prave izuzetak za AI. Principi se direktno prevode u inženjerske odluke:

| Princip | Pitanje za AI sistem | Inženjerska kontrola |
|---|---|---|
| Zakonitost i pravni osnov | Na osnovu čega smijemo koristiti ove podatke za treniranje? | Pravni osnov upisan uz svaki izvor u inventaru |
| Ograničenje svrhe | Podaci prikupljeni za podršku korisnicima, da li smiju za treniranje? | Oznaka svrhe na skupu; pipeline odbija skup bez dozvoljene svrhe |
| **Minimizacija** | Treba li modelu ime, JMBG i adresa da nauči klasifikaciju tiketa? | Uklanjanje ili pseudonimizacija prije treniranja |
| Tačnost | Šta ako model „zna“ zastarjele podatke o osobi? | Verzionisanje, mogućnost ponovnog treniranja |
| Ograničenje čuvanja | Koliko dugo čuvamo promptove i logove? | Definisan rok i automatsko brisanje |
| Integritet i povjerljivost | Ko ima pristup skupovima i logovima? | RBAC, šifrovanje, audit |

Za obradu koja vjerovatno predstavlja visok rizik (nove tehnologije, obrada u velikom obimu, profilisanje) obje regulative traže **procjenu uticaja na zaštitu podataka** (DPIA). Većina projekata koji treniraju ili fine-tunuju modele na podacima o klijentima ili zaposlenima spada ovdje.

### Memorisanje i napadi na privatnost

Modeli mogu **memorisati** dijelove podataka za treniranje i reprodukovati ih u odgovoru, posebno rijetke nizove koji se ponavljaju (npr. potpis mejla sa brojem telefona). NIST AI 100-2 u taksonomiji adversarial ML-a opisuje i napade na privatnost: rekonstrukciju podataka, **membership inference** (zaključivanje da li je zapis bio u skupu za treniranje) i ekstrakciju podataka iz modela. Detaljnije u modulu 09; ovdje je važna posljedica za upravljanje podacima:

**Lični podatak koji je ušao u težine modela ne može se pouzdano „obrisati“ bez ponovnog treniranja.** Zato se minimizacija radi prije treniranja, ne poslije.

Kontrole koje smanjuju memorisanje i curenje:

- uklanjanje i pseudonimizacija direktnih identifikatora prije treniranja,
- **deduplikacija**: ponovljeni zapisi se memorišu znatno lakše,
- tehnike treniranja sa formalnim garancijama privatnosti (**differential privacy**) gdje je rizik visok i gubitak tačnosti prihvatljiv,
- evaluacija prije objave: test da li model reprodukuje kanarince ili poznate osjetljive nizove iz skupa,
- filtriranje izlaza na lične podatke kao dodatni sloj (modul 04).

> **U praksi:** prije nego što pitaš „kako da anonimizujemo podatke za fine-tuning“, pitaj „treba li modelu ovaj podatak uopšte“. Za klasifikaciju tiketa ili sažimanje dokumentacije model gotovo nikad ne treba imena i brojeve. Ono što nikad ne uđe u skup ne može ni procuriti, a ne treba ni DPIA argumentacija za to.

### Lični podaci u promptovima i logovima

Kod inferencije korisnici sami unose podatke: mejlove klijenata, ugovore, zdravstvene podatke. Ti podaci završe u logovima aplikacije, u logovima dobavljača modela i ponekad u skupovima za buduće treniranje.

| Pitanje | Kontrola |
|---|---|
| Da li dobavljač koristi naše promptove za treniranje? | Ugovor i podešavanje naloga; poslovni planovi obično to isključuju, ali se provjerava |
| Koliko dugo dobavljač čuva promptove? | Ugovorni rok zadržavanja; za osjetljive slučajeve opcije bez zadržavanja gdje postoje |
| Šta mi logujemo? | Redakcija prije upisa; puni promptovi samo gdje su potrebni, sa kraćim rokom i užim pristupom |
| Ko čita logove? | Pristup kao za produkcione podatke, sa auditom |
| Šta kad korisnik zalijepi tajnu? | Detekcija tajni na ulazu i u logovima, rotacija ako je tajna otišla dobavljaču |

```python
import re

PATTERNS = {
    "EMAIL": re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
    "IBAN":  re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b"),
    "JMBG":  re.compile(r"\b\d{13}\b"),
    "PHONE": re.compile(r"\+?\d[\d /-]{7,}\d"),
}

def redact(text: str) -> tuple[str, dict]:
    """Zamjenjuje lične podatke oznakama prije logovanja ili slanja u skup za treniranje."""
    counts = {}
    for label, rx in PATTERNS.items():
        text, n = rx.subn(f"[{label}]", text)
        if n:
            counts[label] = n
    return text, counts            # counts ide u metriku, ne originalne vrijednosti
```

Regex je dobar početak, ali propušta imena, adrese i slobodan tekst. U produkciji se koriste namjenski alati za detekciju ličnih podataka (npr. Microsoft Presidio, kombinacija pravila i NER modela), uz mjerenje koliko propuštaju na uzorku sa ručno označenim podacima.

## Upravljanje podacima za treniranje

### Inventar i dokumentacija skupova

Svaki skup koji se koristi za treniranje, fine-tuning ili evaluaciju je **artefakt** kao i kod: ima vlasnika, verziju i porijeklo. Praksa „datasheets for datasets“ i **data cards** traži da se uz skup dokumentuje:

- izvor i način prikupljanja, pravni osnov i licenca,
- svrha i dozvoljena upotreba (i zabranjena),
- da li sadrži lične ili posebne kategorije podataka i kako su obrađeni,
- poznata ograničenja i pristrasnosti, raspodjela po bitnim grupama,
- verzija, hash snapshota, ko ga je odobrio.

```yaml
# datasets/tiketi-klasifikacija/datacard.yaml
name: tiketi-klasifikacija
version: 2026.09.1
owner: tim-podrska-ml
sources:
  - system: helpdesk
    period: 2024-01..2026-08
    legal_basis: legitimni_interes        # potvrđeno sa DPO, ref. DPIA-2026-014
    license: interno
purpose: [klasifikacija_tiketa]
forbidden_use: [profilisanje_zaposlenih]
personal_data:
  direct_identifiers: removed             # redakcija v3, izvještaj u reports/
  special_categories: none_detected
snapshot:
  uri: s3://ml-data/tiketi/2026.09.1/
  manifest_sha256: 9b2e…
approved_by: [vlasnik-podataka, dpo]
```

### Porijeklo, verzionisanje i integritet

- Skup za treniranje je **nepromjenjiv snapshot**: novi podaci znače novu verziju, ne izmjenu postojeće.
- Uz snapshot ide **manifest** sa hashom svakog fajla; pipeline za treniranje provjerava manifest prije starta.
- Alati za verzionisanje podataka (npr. DVC, lakeFS ili verzionisan object storage sa object lockom) daju vezu „ovaj model je treniran na tačno ovoj verziji podataka“.
- Pristup pisanju u skupove imaju samo pipeline i mali broj ljudi; čitanje je odvojeno od pisanja.
- Lineage: od modela u produkciji mora se moći doći do verzije skupa, koda i konfiguracije treniranja. To je preduslov za odgovor na incident trovanja i za zahtjeve regulatora.

```python
import hashlib, json, pathlib, sys

def verify_manifest(root: str, manifest_path: str) -> None:
    manifest = json.loads(pathlib.Path(manifest_path).read_text())
    bad = []
    for rel, expected in manifest["files"].items():
        h = hashlib.sha256(pathlib.Path(root, rel).read_bytes()).hexdigest()
        if h != expected:
            bad.append(rel)
    extra = {str(p.relative_to(root)) for p in pathlib.Path(root).rglob("*") if p.is_file()} - set(manifest["files"])
    if bad or extra:
        sys.exit(f"integritet skupa narušen: izmijenjeni={bad} neočekivani={sorted(extra)}")
```

Manifest je jak koliko i zaštita samog manifesta: čuva se odvojeno od podataka, sa užim pravima pisanja, i idealno se potpisuje (isti princip kao potpis modela u modulu 08).

> **U praksi:** traži od ML tima da za model u produkciji pokaže tačnu verziju skupa na kojem je treniran. Ako odgovor glasi „bio je to folder `data/final_v2_novo` na nečijem laptopu“, prvi zadatak nije napredna detekcija trovanja nego verzionisanje i manifest. Bez lineagea ne možeš ni utvrditi da je incident trovanja postojao.

### Zahtjevi EU AI Acta za podatke

Za visokorizične sisteme **član 10 EU AI Acta** (Uredba (EU) 2024/1689) traži prakse upravljanja podacima za skupove za treniranje, validaciju i testiranje: dokumentovane odluke o dizajnu i prikupljanju, porijeklo, pripremu (označavanje, čišćenje), ispitivanje mogućih pristrasnosti i mjere za njihovo otkrivanje i ublažavanje, kao i da skupovi budu relevantni, dovoljno reprezentativni i u najvećoj mogućoj mjeri bez grešaka i potpuni za namjenu. Posebne kategorije ličnih podataka smiju se izuzetno obrađivati radi otkrivanja i ispravljanja pristrasnosti, uz stroge zaštitne mjere.

Rokovi: nakon izmjena iz paketa **AI Omnibus** (Uredba (EU) 2026/1744), obaveze za visokorizične sisteme iz Aneksa III primjenjuju se od 2. decembra 2027, a za one iz Aneksa I od 2. avgusta 2028. Prakse iz ovog modula (inventar, data cards, lineage, provjera pristrasnosti) su upravo ono što će se tražiti kao dokaz, pa ih vrijedi uvesti prije roka. Klasifikacija sistema po riziku je tema modula 11.

### Pseudonimizacija nije anonimizacija

Timovi često kažu „podaci su anonimizovani“ kada su samo zamijenili imena oznakama. Razlika je pravno i tehnički bitna:

| Tehnika | Šta radi | Da li su podaci i dalje lični? |
|---|---|---|
| **Pseudonimizacija** | Identifikatori zamijenjeni oznakama ili tokenima; ključ za povezivanje postoji negdje | Da. GDPR i ZZPL i dalje važe; smanjuje rizik, ali ne izuzima |
| Redakcija | Identifikatori uklonjeni iz teksta | Zavisi od ostatka: slobodan tekst često sadrži dovoljno za ponovnu identifikaciju |
| **Anonimizacija** | Osoba se ne može identifikovati razumno dostupnim sredstvima | Ne, ali je stvarnu anonimizaciju teško postići i dokazati |
| Sintetički podaci | Novi zapisi generisani iz modela stvarnih podataka | Zavisi: generator može reprodukovati stvarne zapise; potrebna provjera |
| Agregacija | Samo zbirne vrijednosti | Obično ne, osim za vrlo male grupe |

Kombinacija rijetkih atributa (poštanski broj, datum rođenja, zanimanje) često je dovoljna za identifikaciju. Zato se tvrdnja o anonimizaciji dokumentuje i provjerava sa DPO-om, a u data cardu se piše tačna tehnika, ne opšti pojam.

### Fine-tuning kod dobavljača modela

Kada se fine-tuning radi preko API-ja dobavljača, skup za treniranje napušta organizaciju. Uz pitanja iz tabele o promptovima vrijedi i:

- gdje se čuvaju poslati skupovi i fine-tunovani model, i kako se brišu,
- da li je fine-tunovani model dostupan samo tvojoj organizaciji,
- da li dobavljač provodi sopstvene provjere sadržaja skupa i šta se dešava sa odbijenim zapisima,
- da li ugovor pokriva prenos podataka van EU/EEA, ako je primjenljivo.

> **U praksi:** uvedi pravilo da nijedan skup ne ide na treniranje (interno ili kod dobavljača) bez data carda koji je potpisao vlasnik podataka. To je mali administrativni korak koji prisiljava tim da odgovori na pitanja o pravnom osnovu, ličnim podacima i licenci prije nego što podaci uđu u težine, kada je odgovor još jeftin.

## Trovanje podataka

### Taksonomija

**NIST AI 100-2** (Adversarial Machine Learning: A Taxonomy and Terminology of Attacks and Mitigations) razlikuje napade trovanja po cilju:

| Klasa (NIST AI 100-2) | Cilj napadača | Kako izgleda posljedica |
|---|---|---|
| **Availability poisoning** | Opšte pogoršanje modela | Tačnost pada za sve, model postaje neupotrebljiv |
| **Targeted poisoning** | Pogrešno ponašanje za određene ulaze | Model griješi samo na izabranim primjerima |
| **Backdoor poisoning** | Skriveno ponašanje aktivirano okidačem | Model radi normalno dok se ne pojavi određen obrazac |
| **Model poisoning** | Direktna izmjena modela ili ažuriranja | Npr. zlonamjerno ažuriranje u federativnom učenju |

Kod generativnih modela isti obrasci se javljaju u podacima za fine-tuning, u skupovima instrukcija i u povratnoj petlji (ocjene korisnika). OWASP to pokriva kao **LLM04:2025 Data and Model Poisoning**, a MITRE ATLAS kao **AML.T0020 Poison Training Data**, **AML.T0019 Publish Poisoned Datasets** i **AML.T0010.002** (kompromitovanje lanca snabdijevanja podataka).

### Uslovi koji omogućavaju trovanje

- podaci iz izvora koje napadač može uticati: javni web, otvoreni skupovi, forumi, tiketi i ocjene korisnika,
- skupovi preuzeti po URL-u bez provjere integriteta (sadržaj na URL-u se može promijeniti poslije objave liste, npr. kad domen istekne i preuzme ga neko drugi),
- širok pristup pisanju u interne skupove,
- nema reviewa ni statističke provjere prije treniranja,
- nema lineagea, pa se zatrovan skup ne može naći ni ukloniti.

### Odbrana po fazama

| Faza | Kontrola | ATLAS mitigacija |
|---|---|---|
| Izbor izvora | Allowlista izvora sa vlasnikom; procjena povjerenja za javne skupove | — |
| Preuzimanje | Hash sadržaja pri prvom preuzimanju, poređenje pri svakom sljedećem; preuzimanje iz pouzdanih kopija | **AML.M0025** Maintain AI Dataset Provenance |
| Prijem | Validacija šeme, deduplikacija, detekcija ekstremnih vrijednosti, raspodjela oznaka u odnosu na prethodnu verziju | **AML.M0007** Sanitize Training Data |
| Skladištenje | Nepromjenjivi snapshotovi, manifest, kontrola pristupa pisanju | **AML.M0005** Control Access to AI Models and Data at Rest |
| Treniranje | Provjera manifesta prije starta; izolovano okruženje | **AML.M0014** Verify AI Artifacts |
| Evaluacija | Poređenje sa prethodnim modelom na fiksnom skupu, testovi za poznate okidače i ciljane klase | **AML.M0008** Validate AI Model |
| Povratna petlja | Ocjene korisnika ne ulaze direktno u treniranje; review, limit doprinosa po korisniku | — |

### Statistička provjera prije treniranja

Jednostavne provjere hvataju mnogo grešaka i grubih pokušaja trovanja. Ne garantuju otkrivanje pažljivo napravljenog backdoora, ali podižu cijenu napada i daju signal:

```python
import numpy as np

def label_shift(prev: np.ndarray, curr: np.ndarray, n_classes: int, tol=0.05) -> list[int]:
    """Vraća klase čiji se udio promijenio više od tol u odnosu na prethodnu verziju skupa."""
    p = np.bincount(prev, minlength=n_classes) / len(prev)
    c = np.bincount(curr, minlength=n_classes) / len(curr)
    return [k for k in range(n_classes) if abs(p[k] - c[k]) > tol]

def duplicate_ratio(texts: list[str]) -> float:
    norm = [" ".join(t.lower().split()) for t in texts]
    return 1 - len(set(norm)) / len(norm)

# Gate u pipelineu: promjena raspodjele, nagli rast duplikata ili veliki doprinos
# jednog izvora/korisnika zaustavlja treniranje i otvara review.
```

| Signal | Mogući uzrok |
|---|---|
| Udio jedne klase naglo porastao | Greška u izvoru ili ciljano trovanje |
| Mnogo skoro identičnih primjera | Masovno ubacivanje istog obrasca |
| Jedan korisnik ili izvor daje velik udio novih primjera | Zloupotreba povratne petlje |
| Model bolji na prosjeku, lošiji na jednoj podgrupi | Ciljano trovanje ili pristrasnost |
| Neobičan niz se ponavlja u primjerima sa istom oznakom | Mogući okidač backdoora |

> **U praksi:** povratna petlja je najčešće zanemaren put trovanja. Dugme „palac gore“ koje direktno puni skup za sljedeći fine-tuning znači da svako sa nalogom piše u tvoje podatke za treniranje. Uvedi limit doprinosa po korisniku, review uzorka i odvojen nivo povjerenja za takve podatke.

### Ako je trovanje otkriveno

1. Zaustavi treniranje i deploy novih verzija koje koriste sumnjiv skup.
2. Preko lineagea pronađi sve modele trenirane na toj verziji podataka.
3. Vrati produkciju na posljednji model treniran na provjerenoj verziji (zato se stari modeli i skupovi čuvaju).
4. Ukloni zatrovane zapise, napravi novu verziju skupa i ponovo treniraj.
5. Utvrdi kako su podaci ušli i zatvori taj put (izvor, pristup, povratna petlja).

## Kontrolna lista za data pipeline

| Oblast | Pitanje | Dokaz |
|---|---|---|
| Inventar | Da li svaki skup ima vlasnika, svrhu, pravni osnov i licencu? | Data card |
| Lični podaci | Da li su direktni identifikatori uklonjeni prije treniranja? | Izvještaj redakcije, mjerenje propuštanja |
| DPIA | Da li je urađena procjena uticaja gdje je obrada rizična? | DPIA dokument |
| Integritet | Da li je skup nepromjenjiv snapshot sa zaštićenim manifestom? | Manifest, potpis, object lock |
| Pristup | Ko može pisati u skupove i logove? | IAM politika, audit log |
| Provjera | Da li pipeline ima statistički gate prije treniranja? | Konfiguracija pipelinea, izvještaji |
| Lineage | Može li se od modela doći do verzije podataka? | Zapis u registryju modela |
| Logovi | Da li su definisani redakcija i rokovi čuvanja? | Konfiguracija, politika |
| Dobavljači | Da li ugovori isključuju treniranje na našim podacima i definišu zadržavanje? | Ugovor, podešavanja naloga |
| Oporavak | Da li se čuvaju prethodni model i skup za vraćanje? | Registry, retention politika |

## Mapiranje na okvire

| Tema | Okvir | Šta traži |
|---|---|---|
| Trovanje podataka i modela | OWASP LLM04:2025 | Porijeklo, provjera i izolacija podataka, evaluacija |
| Lični podaci u odgovorima | OWASP LLM02:2025 Sensitive Information Disclosure | Minimizacija, redakcija, filtriranje izlaza |
| Napadi na podatke | NIST AI 100-2 | Taksonomija trovanja i napada na privatnost |
| Upravljanje rizikom podataka | NIST AI RMF (funkcije Map i Measure) | Dokumentovani podaci, mjerenje pristrasnosti i kvaliteta |
| Podaci visokorizičnih sistema | EU AI Act, član 10 | Data governance, reprezentativnost, pristrasnost |
| Zaštita ličnih podataka | GDPR, ZZPL | Pravni osnov, minimizacija, DPIA, prava lica |
| Upravljanje AI sistemom | ISO/IEC 42001 (Aneks A, podaci za AI sisteme) | Procesi za kvalitet, porijeklo i pripremu podataka |

## Rezime

- Podaci u AI sistemu prolaze kroz prikupljanje, označavanje, skupove, težine modela, promptove, logove i povratnu petlju; svako mjesto ima svoj rizik i vlasnika.
- GDPR i ZZPL važe i za AI: pravni osnov, ograničenje svrhe, **minimizacija**, rokovi čuvanja, DPIA za rizičnu obradu.
- Lični podatak u težinama modela se ne može pouzdano obrisati bez ponovnog treniranja: minimizuj i deduplikuj prije, evaluiraj curenje prije objave.
- Promptovi i logovi: redakcija prije logovanja, rokovi, uslovi dobavljača (treniranje, zadržavanje), detekcija tajni.
- Skup za treniranje je artefakt: data card, vlasnik, pravni osnov, licenca, nepromjenjiv snapshot sa manifestom, kontrola pristupa, lineage do modela.
- EU AI Act član 10 traži upravljanje podacima i ispitivanje pristrasnosti za visokorizične sisteme; po AI Omnibusu Aneks III od 2. 12. 2027, Aneks I od 2. 8. 2028.
- Trovanje (NIST AI 100-2): availability, targeted, backdoor i model poisoning; OWASP **LLM04:2025**, ATLAS **AML.T0020**, **AML.T0019**, **AML.T0010.002**.
- Odbrana: allowlista izvora, hash pri preuzimanju, validacija i statističke provjere, nepromjenjivi snapshotovi, evaluacija u odnosu na prethodni model, kontrolisana povratna petlja i plan za vraćanje na provjeren model.
