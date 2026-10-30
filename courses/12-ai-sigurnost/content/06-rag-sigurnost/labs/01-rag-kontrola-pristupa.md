# Lab 1: Kontrola pristupa u RAG pretrazi

Interni asistent kurs-shopa odgovara na pitanja iz dokumenata firme (RAG). Problem: pretraga vraća najrelevantnije dokumente **bez obzira na to ko pita**, pa asistent zaposleniku iz prodaje može „citirati“ platne liste. Model ne smije biti mjesto gdje se provjeravaju prava: dokument koji korisnik ne smije vidjeti ne smije ni ući u kontekst (OWASP LLM08: Vector and Embedding Weaknesses, LLM02: Sensitive Information Disclosure).

U `/root/rag/dokumenti/` su dokumenti sa zaglavljem `grupe:` (ko smije čitati), a u `/root/rag/korisnici.json` korisnici i njihove grupe. Pretraga je jednostavna (broj poklapanja riječi); u stvarnosti bi bila vektorska, ali kontrola pristupa radi isto.

```bash
cd /root/rag
head -3 dokumenti/*.md
cat korisnici.json
```

<!-- setup
set -e
mkdir -p /root/rag/dokumenti
cd /root/rag/dokumenti
cat > politika-povrata.md <<'EOF'
grupe: svi
Politika povrata: kupac može vratiti robu u roku od 14 dana uz račun. Povrat novca ide na istu karticu.
EOF
cat > plate-2026.md <<'EOF'
grupe: hr, uprava
Plate 2026: prosječna plata u prodaji je 1850 KM. Kontakt za pitanja o plati: hr@kurs-shop.ba, IBAN za isplate BA391290079401028494.
EOF
cat > prodaja-cjenovnik.md <<'EOF'
grupe: prodaja, uprava
Cjenovnik za veleprodaju: popust 12 posto za narudžbe preko 500 KM. Povrat robe za veleprodaju je 7 dana.
EOF
cat > incident-2026-09.md <<'EOF'
grupe: security
Izvještaj o incidentu iz septembra: kompromitovan nalog prodaja2, lozinka promijenjena, kontakt soc@kurs-shop.ba.
EOF
cat > onboarding.md <<'EOF'
grupe: svi
Dobrodošlica: radno vrijeme je od 8 do 16. Kontakt za IT probleme: it@kurs-shop.ba.
EOF
cat > /root/rag/korisnici.json <<'EOF'
{
  "ana": ["prodaja"],
  "marko": ["hr"],
  "jelena": ["uprava"],
  "ivan": [],
  "sara": ["security", "prodaja"]
}
EOF
-->

## Pretraga sa filtriranjem prava

Napiši `/root/rag/pretraga.py` sa funkcijom `pretrazi(korisnik, upit, k=3)` koja vraća listu imena dokumenata (npr. `"politika-povrata.md"`):

1. **Prvo** odbaci dokumente koje korisnik ne smije čitati (grupa `svi` je za sve; inače presjek grupa korisnika i dokumenta ne smije biti prazan). Nepoznat korisnik ne dobija ništa.
2. Zatim rangiraj preostale po broju riječi upita (mala slova) koje se pojavljuju u tekstu dokumenta (bez zaglavlja), opadajuće; pri jednakom broju po imenu fajla; dokumenti sa 0 poklapanja se ne vraćaju.
3. Vrati najviše `k` dokumenata.

Pokretanje `/opt/ai/bin/python pretraga.py <korisnik> "<upit>"` ispisuje imena dokumenata, jedno po redu.

<!-- verify
cd /root/rag
[ -f pretraga.py ] || { echo "nema pretraga.py"; exit 1; }
/opt/ai/bin/python - <<'EOF' || exit 1
import importlib.util, sys
spec = importlib.util.spec_from_file_location("p", "/root/rag/pretraga.py"); m = importlib.util.module_from_spec(spec)
sys.argv = ["x"]
try: spec.loader.exec_module(m)
except SystemExit: pass
T = [(("ana", "povrat robe"), ["prodaja-cjenovnik.md", "politika-povrata.md"]),
     (("ivan", "povrat robe"), ["politika-povrata.md"]),
     (("ana", "plata kontakt"), ["onboarding.md"]),
     (("marko", "plata kontakt"), ["plate-2026.md", "onboarding.md"]),
     (("jelena", "plata povrat"), ["plate-2026.md", "politika-povrata.md", "prodaja-cjenovnik.md"]),
     (("sara", "incident lozinka"), ["incident-2026-09.md"]),
     (("ana", "incident lozinka"), []),
     (("nepoznati", "povrat"), []),
     (("jelena", "povrat robe", 1), ["prodaja-cjenovnik.md"])]
for args, want in T:
    got = m.pretrazi(*args)
    if list(got) != want: sys.exit(f"pretrazi{args} = {got}, očekivano {want}")
EOF
-->
<!-- hint
```python
def citaj(put):
    lines = open(put, encoding="utf-8").read().splitlines()
    grupe = {g.strip() for g in lines[0].split(":", 1)[1].split(",")}
    tekst = "\n".join(lines[1:]).lower()
    return grupe, tekst
```
Bodovanje: `sum(1 for r in set(upit.lower().split()) if r in tekst)`. Filtriranje **prije** rangiranja i ograničenja `k` je bitno: ako filtriraš poslije `top-k`, korisnik dobija manje rezultata, a u pravom sistemu kroz rangiranje i dalje „curi“ informacija o postojanju dokumenata.
-->
<!-- solution
cat > /root/rag/pretraga.py <<'EOF'
import json, os, sys
D = "/root/rag/dokumenti"
KORISNICI = json.load(open("/root/rag/korisnici.json"))

def citaj(put):
    lines = open(put, encoding="utf-8").read().splitlines()
    grupe = {g.strip() for g in lines[0].split(":", 1)[1].split(",")}
    return grupe, "\n".join(lines[1:])

def pretrazi(korisnik, upit, k=3):
    if korisnik not in KORISNICI:
        return []
    moje = set(KORISNICI[korisnik])
    rijeci = set(upit.lower().split())
    rez = []
    for f in sorted(os.listdir(D)):
        grupe, tekst = citaj(os.path.join(D, f))
        if "svi" not in grupe and not (grupe & moje):
            continue
        s = sum(1 for r in rijeci if r in tekst.lower())
        if s > 0:
            rez.append((-s, f))
    return [f for _, f in sorted(rez)[:k]]

if __name__ == "__main__" and len(sys.argv) >= 3:
    for f in pretrazi(sys.argv[1], " ".join(sys.argv[2:])):
        print(f)
EOF
-->

## Redakcija prije konteksta

I dokument koji korisnik smije čitati može sadržati podatke koji ne trebaju modelu (i završe u logovima provajdera). Dodaj u `pretraga.py` funkciju `kontekst(korisnik, upit, k=3)` koja vraća listu stringova: tekst svakog dokumenta iz `pretrazi` (bez zaglavlja), sa e-mail adresama zamijenjenim sa `[EMAIL]` i IBAN-ima sa `[IBAN]`.

<!-- verify
/opt/ai/bin/python - <<'EOF' || exit 1
import importlib.util, sys
spec = importlib.util.spec_from_file_location("p", "/root/rag/pretraga.py"); m = importlib.util.module_from_spec(spec)
sys.argv = ["x"]
try: spec.loader.exec_module(m)
except SystemExit: pass
if not hasattr(m, "kontekst"): sys.exit("nema funkcije kontekst")
c = m.kontekst("marko", "plata kontakt")
if len(c) != 2: sys.exit(f"kontekst za marko treba 2 dokumenta, ima {len(c)}")
s = "\n".join(c)
if "@" in s or "BA39" in s: sys.exit("e-mail ili IBAN nisu redigovani")
if "[EMAIL]" not in s or "[IBAN]" not in s: sys.exit("očekivane oznake [EMAIL] i [IBAN]")
if "grupe:" in s: sys.exit("zaglavlje grupe: ne ide u kontekst")
if "1850 KM" not in s: sys.exit("ostali tekst treba ostati")
if m.kontekst("ana", "plata kontakt") != [x for x in m.kontekst("ana", "plata kontakt") if "1850" not in x]: sys.exit("ana ne smije dobiti platne podatke")
EOF
-->
<!-- hint
```python
import re
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")
IBAN = re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b")
```
-->
<!-- solution
cat >> /root/rag/pretraga.py <<'EOF'

import re
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
IBAN = re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b")

def kontekst(korisnik, upit, k=3):
    out = []
    for f in pretrazi(korisnik, upit, k):
        _, tekst = citaj(os.path.join(D, f))
        out.append(IBAN.sub("[IBAN]", EMAIL.sub("[EMAIL]", tekst)))
    return out
EOF
-->
